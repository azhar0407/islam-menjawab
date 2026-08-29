const batasPerIp = new Map();
const BATAS_PER_MENIT = 5;
const JENDELA_MS = 60_000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/tanya' && request.method === 'POST') {
      try {
        const body = await request.json();
        const pertanyaan = String(body.pertanyaan || '').trim();
        if (!pertanyaan) return json({ error: 'Pertanyaan kosong.' }, 400);
        if (pertanyaan.length > 2000) return json({ error: 'Pertanyaan terlalu panjang. Maksimal 2000 karakter.' }, 413);
        const ip = request.headers.get('CF-Connecting-IP') || 'tidak-diketahui';
        if (!bolehMeminta(ip)) return json({ error: 'Terlalu banyak permintaan. Coba lagi sebentar.' }, 429);

        const { jawaban, sumber } = await tanya(env, pertanyaan);
        return json({ jawaban, sumber });
      } catch (e) {
        console.error('Permintaan gagal:', e);
        return json({ error: 'Layanan sedang bermasalah. Coba lagi nanti.' }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};

const SYSTEM_PROMPT = `Anda adalah asisten informasi Islam berbahasa Indonesia.

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
Informasi umum, bukan fatwa. [tambahan keterbatasan atau rujukan ahli bila perlu]`;

function bolehMeminta(ip) {
  const sekarang = Date.now();
  const riwayat = (batasPerIp.get(ip) || []).filter(waktu => sekarang - waktu < JENDELA_MS);
  if (riwayat.length >= BATAS_PER_MENIT) return false;
  riwayat.push(sekarang);
  batasPerIp.set(ip, riwayat);
  // ponytail: cache per-isolate; gunakan Worker standar + binding Rate Limiting bila Pages mendukungnya.
  if (batasPerIp.size > 1000) {
    for (const [key, waktu] of batasPerIp) {
      if (!waktu.some(item => sekarang - item < JENDELA_MS)) batasPerIp.delete(key);
    }
  }
  return true;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

async function tanya(env, pertanyaan) {
  const ayat = await cariAyat(env, pertanyaan, 3);
  const konteks = ayat.map(a => `QS. ${a.nama} ${a.surat}:${a.ayat} — ${a.teks}`).join('\n') || '(tidak ada ayat yang ditemukan)';
  const sumber = ayat.map(a => ({ surah: a.surat, nama: a.nama, ayat: a.ayat, teks: a.teks }));
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `[KONTEKS AYAT]\n${konteks}\n\n[PERTANYAAN]\n${pertanyaan}` },
  ];
  const jawaban = await panggilLLM(env, messages);
  return { jawaban, sumber };
}

async function panggilLLM(env, messages) {
  const result = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages, temperature: 0.2, max_tokens: 900 });
  const content = typeof result === 'string' ? result : result?.response;
  if (!content) throw new Error('Respons AI kosong');
  return content.trim();
}

const datasetCache = new WeakMap();

async function cariAyat(env, query, topK = 3) {
  // Cache hidup selama isolate Worker; KV tetap sumber utama setelah isolate baru.
  if (!datasetCache.has(env.QURAN)) datasetCache.set(env.QURAN, env.QURAN.get('dataset', 'json'));
  const data = await datasetCache.get(env.QURAN);
  if (!Array.isArray(data) || !data.length) return [];
  const stop = new Set('apa bagaimana mengapa yang dan atau di ke dari untuk pada dengan ini itu bisa tidak apakah jika'.split(' '));
  const kata = [...new Set((query.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !stop.has(w) && w.length > 2))];
  if (!kata.length) return [];
  const df = Object.fromEntries(kata.map(k => [k, 0]));
  for (const a of data) {
    const t = String(a.teks || '').toLowerCase();
    for (const k of kata) if (t.includes(k)) df[k]++;
  }
  const n = Math.max(data.length, 1);
  return data.map(normalize).map(a => ({ a, s: score(a, kata, df, n) })).filter(x => x.s > 0).sort((x, y) => y.s - x.s).slice(0, topK).map(x => x.a);
}

function normalize(a) {
  return { surat: a.surat, ayat: a.ayat, teks: a.teks, nama: a.nama || `Surah ${a.surat}` };
}

function score(a, kata, df, n) {
  const t = String(a.teks || '').toLowerCase();
  let s = 0;
  for (const k of kata) if (t.includes(k)) s += 1 + Math.sqrt(n / (df[k] + 1));
  return s;
}
