import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './public/_worker.js';

const request = (pertanyaan) => new Request('https://contoh.id/api/tanya', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ pertanyaan }),
});

const env = {
  RATE_LIMITER: { limit: async () => ({ success: true }) },
  QURAN: { get: async () => [] },
  AI: { run: async () => ({ response: 'Jawaban aman' }) },
};

test('menolak pertanyaan melebihi 2000 karakter', async () => {
  const response = await worker.fetch(request('a'.repeat(2001)), env);
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { error: 'Pertanyaan terlalu panjang. Maksimal 2000 karakter.' });
});

test('menolak IP yang melewati rate limit', async () => {
  let aiDipanggil = false;
  const dibatasi = {
    ...env,
    RATE_LIMITER: { limit: async () => ({ success: false }) },
    AI: { run: async () => { aiDipanggil = true; return { response: 'jangan dipanggil' }; } },
  };
  const response = await worker.fetch(request('Apa itu sabar?'), dibatasi);
  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: 'Terlalu banyak permintaan. Coba lagi sebentar.' });
  assert.equal(aiDipanggil, false);
});

test('menyembunyikan galat internal', async () => {
  const rusak = {
    ...env,
    QURAN: { get: async () => { throw new Error('KV namespace rahasia'); } },
  };
  const asli = console.error;
  console.error = () => {};
  try {
    const response = await worker.fetch(request('Apa itu sabar?'), rusak);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Layanan sedang bermasalah. Coba lagi nanti.' });
  } finally {
    console.error = asli;
  }
});

test('tidak mengirim ayat acak untuk pertanyaan tanpa kata bermakna', async () => {
  let pesan;
  const berdata = {
    ...env,
    QURAN: { get: async () => [{ surat: 1, ayat: 1, nama: 'Al-Fatihah', teks: 'Dengan nama Allah' }] },
    AI: { run: async (_model, input) => { pesan = input.messages.at(-1).content; return { response: 'Jawaban aman' }; } },
  };
  const response = await worker.fetch(request('apa bagaimana ini'), berdata);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).sumber, []);
  assert.match(pesan, /tidak ada ayat yang ditemukan/);
});

test('menyimpan dataset KV dalam cache isolate', async () => {
  let dibaca = 0;
  const berdata = {
    ...env,
    QURAN: { get: async () => { dibaca++; return [{ surat: 2, ayat: 153, nama: 'Al-Baqarah', teks: 'mohonlah pertolongan dengan sabar' }]; } },
  };
  await worker.fetch(request('Apa itu sabar?'), berdata);
  await worker.fetch(request('Bagaimana sabar?'), berdata);
  assert.equal(dibaca, 1);
});

test('tidak membuka API lintas situs', async () => {
  const response = await worker.fetch(request('Apa itu sabar?'), env);
  assert.equal(response.headers.has('access-control-allow-origin'), false);
});
