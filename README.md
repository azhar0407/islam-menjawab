# Islam Menjawab

Aplikasi informasi Islam di Cloudflare Pages.

- UI: `public/index.html`
- API: `POST /api/tanya`
- Dataset: terjemahan Al-Qur'an dalam Cloudflare KV
- Model: Cloudflare Workers AI
- Batas: 5 pertanyaan per menit per IP; maksimal 2.000 karakter

> Jawaban merupakan informasi umum, bukan fatwa. Verifikasi perkara sensitif kepada ulama tepercaya.

## Pengembangan

```bash
npm ci
npm test
npm run dev
```

## Deployment

Push ke `main` menjalankan `.github/workflows/deploy-cloudflare.yml`.
GitHub Secrets wajib:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Dataset `quran.json` diunggah ke KV saat deployment. Cantumkan sumber dan lisensi terjemahan sebelum mendistribusikan ulang dataset.
