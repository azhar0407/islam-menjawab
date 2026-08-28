"""
Kamu Bertanya, Islam Menjawab - backend FastAPI
Sumber jawaban: terjemahan-quran.pdf (di-parse sekali saat start)
AI: OracleFree (combo lokal 9 Router), tanpa tools, dengan rate-limit + timeout
"""
import os
import re
import json
import time
import subprocess
import asyncio
import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

LLM_BASE_URL = os.getenv("LLM_BASE_URL", "http://127.0.0.1:20128/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY", "sk-")
MODEL_NAMA = os.getenv("MODEL_NAMA", "OracleFree")
PDF_PATH = Path(os.getenv("PDF_PATH", "/home/ubuntu/terjemahan-quran.pdf"))
MAX_RIWAYAT = 20          # batas memori riwayat per percakapan (RAM kecil)
REQUEST_TIMEOUT = 60      # detik, mencegah request nge-blok
RATE_LIMIT = 5            # max request / 60 detik per IP
RATE_WINDOW = 60

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
    handlers=[
        RotatingFileHandler(BASE_DIR / "web.log", maxBytes=1_000_000, backupCount=2),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("islam")

app = FastAPI(title="Kamu Bertanya, Islam Menjawab")
# Panggil model via HTTP mentah + strip trailing SSE "data: [DONE]" (9 Router memakai format non-baku)
_http = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

async def panggil_llm(messages):
    payload = {"model": MODEL_NAMA, "messages": messages, "temperature": 0.2}
    resp = await _http.post(
        LLM_BASE_URL + "/chat/completions",
        headers={"Authorization": f"Bearer {LLM_API_KEY}", "Content-Type": "application/json"},
        json=payload,
    )
    resp.raise_for_status()
    teks = resp.text
    cut = teks.find("data: [DONE]")
    if cut != -1:
        teks = teks[:cut].strip()
    data = json.loads(teks)
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Respons LLM tidak memiliki choices/message/content") from exc
    if not isinstance(content, str) or not content.strip():
        raise ValueError("Respons LLM kosong")
    return content.strip()

SYSTEM_PROMPT = """Anda adalah asisten informasi Islam berbahasa Indonesia.

Jawab menggunakan pengetahuan umum Islam yang aman dan konteks terjemahan Al-Qur'an yang diberikan. Konteks ayat adalah sumber kutipan, bukan satu-satunya dasar penjelasan.

Aturan:
- Berikan jawaban langsung, ringkas, netral, mudah dipahami.
- Jangan mengarang ayat, nomor surah, hadis, fatwa, ijmak, atau pendapat ulama.
- Kutip maksimal 3 ayat, hanya bila relevan, persis dari [KONTEKS AYAT].
- Jika konteks kosong atau tidak relevan, tulis: "Tidak ditemukan ayat spesifik dalam konteks yang tersedia."
- Jangan menyebut hadis karena basis data hadis tervalidasi tidak tersedia.
- Akui keterbatasan dan perbedaan pendapat fikih tanpa menetapkan fatwa.
- Untuk masalah medis, hukum, keselamatan, pernikahan, talak, waris, atau akidah sensitif, sarankan konsultasi kepada ahli atau ulama tepercaya.
- Jangan menghakimi pengguna.

Gunakan format persis:
Jawaban:
[penjelasan umum]

Dalil Al-Qur'an:
[ayat relevan, atau keterangan tidak ditemukan]

Catatan:
Informasi umum, bukan fatwa. [tambahan keterbatasan atau rujukan ahli bila perlu]
"""

# Riwayat pengguna sengaja tidak disimpan: privasi, tanpa identitas berbasis IP.

# --- PARSE PDF SATU KALI ---
def parse_pdf(path):
    """Ekstrak nama surah + semua ayat (multi-baris di-join) dari PDF."""
    if not path.exists():
        log.error("PDF tidak ditemukan: %s", path)
        return [], {}
    out = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        capture_output=True, text=True, timeout=120,
    )
    teks = out.stdout

    # 1) Nama surah dari header "N. Nama-Surah"
    nama_surat = {}
    pat_header = re.compile(r"^\s*(\d+)\.\s+([^\n]+)$")
    for baris in teks.splitlines():
        m = pat_header.match(baris.strip())
        if m:
            n = int(m.group(1))
            if 1 <= n <= 114 and ":" not in m.group(2):
                nama_surat[n] = m.group(2).strip()

    # 2) Ayat: baris bernomor memulai ayat, baris lanjutan (tanpa nomor) di-join
    ayat = []
    pat = re.compile(r"^\s*(\d+):(\d+)\s+(.+)$")
    cur = None  # (surat, no_ayat, isi[])
    for baris in teks.splitlines():
        m = pat.match(baris)
        if m:
            # simpan ayat sebelumnya
            if cur:
                ayat.append({"surat": cur[0], "ayat": cur[1], "teks": " ".join(cur[2])})
            surat, no_ayat = int(m.group(1)), int(m.group(2))
            if surat <= 114:
                cur = [surat, no_ayat, [m.group(3).strip()]]
            else:
                cur = None
        elif cur:
            b = baris.strip()
            if b and not pat_header.match(b):
                cur[2].append(b)
    if cur:
        ayat.append({"surat": cur[0], "ayat": cur[1], "teks": " ".join(cur[2])})
    log.info("Parse PDF: %d ayat, %d surah", len(ayat), len(nama_surat))
    return ayat, nama_surat

DATASET, NAMA_SURAT = parse_pdf(PDF_PATH)

# stopwords ringan utk pencarian
STOP = set("apa bagaimana mengapa yang dan atau di ke dari untuk pada dengan ini itu bisa tidak apakah jika".split())

def cari_ayat(query, top_k=3):
    """RAG-lite: skor berdasar kata, dibobot IDF (kata jarang lebih penting)."""
    if not DATASET:
        return []
    kata = [w.lower() for w in re.findall(r"[a-zA-Z0-9]+", query) if w.lower() not in STOP and len(w) > 2]
    if not kata:
        return DATASET[:top_k]
    # IDF sederhana: doc_freq = berapa banyak ayat mengandung kata itu
    doc_freq = {k: 0 for k in kata}
    for a in DATASET:
        t = a["teks"].lower()
        for k in kata:
            if k in t:
                doc_freq[k] += 1
    n = max(len(DATASET), 1)
    skor = []
    for a in DATASET:
        t = a["teks"].lower()
        s = 0.0
        for k in kata:
            if k in t:
                # bobot IDF: kata jarang (df kecil) → bobot besar
                s += 1.0 + ((n / (doc_freq[k] + 1)) ** 0.5)
        if s:
            skor.append((s, a))
    skor.sort(key=lambda x: -x[0])
    return [a for _, a in skor[:top_k]]

# --- RATE LIMIT ---
_limiter = {}

def rate_limit(ip):
    now = time.time()
    if ip not in _limiter:
        _limiter[ip] = []
    _limiter[ip] = [t for t in _limiter[ip] if now - t < RATE_WINDOW]
    if len(_limiter[ip]) >= RATE_LIMIT:
        return False
    _limiter[ip].append(now)
    return True

# --- SCHEMA ---
class Tanya(BaseModel):
    pertanyaan: str

class Respon(BaseModel):
    jawaban: str
    sumber: list = []

# --- ROUTES ---
@app.get("/")
async def index():
    return FileResponse(BASE_DIR / "static" / "index.html")

@app.post("/api/tanya")
async def api_tanya(body: Tanya, request: Request):
    pertanyaan = (body.pertanyaan or "").strip()
    if not pertanyaan:
        return JSONResponse({"error": "Pertanyaan kosong."}, status_code=400)
    if not rate_limit(request.client.host):
        return JSONResponse({"error": "Terlalu banyak permintaan. Tunggu sebentar."}, status_code=429)

    hist = []

    hasil = cari_ayat(pertanyaan, top_k=3)
    konteks = "\n".join(
        f"QS. {NAMA_SURAT.get(a['surat'], f"Surah {a['surat']}")} {a['surat']}:{a['ayat']} — {a['teks']}"
        for a in hasil
    ) or "(tidak ada ayat yang ditemukan)"
    sumber = [{
        "surah": a["surat"],
        "nama": NAMA_SURAT.get(a["surat"], f"Surah {a['surat']}"),
        "ayat": a["ayat"],
        "teks": a["teks"],
    } for a in hasil]
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *hist,
        {"role": "user", "content": f"[KONTEKS AYAT]\n{konteks}\n\n[PERTANYAAN]\n{pertanyaan}"},
    ]
    try:
        jawaban = await asyncio.wait_for(panggil_llm(messages), timeout=REQUEST_TIMEOUT)
    except Exception as e:
        log.warning("LLM error: %s", e)
        jawaban = "Mesin AI OracleFree sedang tidak bisa dihubungi. Coba lagi beberapa saat."
        sumber = []


    return Respon(jawaban=jawaban, sumber=sumber)

app.mount("/static", StaticFiles(directory=BASE_DIR / "static"), name="static")

if __name__ == "__main__":
    uvicorn.run("backend:app", host="127.0.0.1", port=8000, workers=1, log_level="warning")
