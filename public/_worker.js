export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return cors(null);

    if (url.pathname === '/api/tanya' && request.method === 'POST') {
      try {
        const body = await request.json();
        const pertanyaan = String(body.pertanyaan || '').trim();
        if (!pertanyaan) return json({ error: 'Pertanyaan kosong.' }, 400);

        const { jawaban, sumber } = await tanya(env, pertanyaan);
        return json({ jawaban, sumber });
      } catch (e) {
        return json({ error: e.message || 'Gagal.' }, 500);
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

function json(data, status = 200) {
  return cors(new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  }));
}

function cors(resp) {
  const headers = new Headers(resp ? resp.headers : undefined);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'content-type,authorization');
  return resp ? new Response(resp.body, { status: resp.status, headers }) : new Response(null, { headers });
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
  const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages, temperature: 0.2, max_tokens: 900 });
  const content = typeof result === 'string' ? result : result?.response;
  if (!content) throw new Error('Respons AI kosong');
  return content.trim();
}

async function cariAyat(env, query, topK = 3) {
  const data = await env.QURAN.get('dataset', 'json');
  if (!Array.isArray(data) || !data.length) return [];
  const stop = new Set('apa bagaimana mengapa yang dan atau di ke dari untuk pada dengan ini itu bisa tidak apakah jika'.split(' '));
  const kata = [...new Set((query.toLowerCase().match(/[a-z0-9]+/g) || []).filter(w => !stop.has(w) && w.length > 2))];
  if (!kata.length) return data.slice(0, topK).map(normalize);
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
