# Islam Menjawab

Cloudflare Pages application with a Pages Worker API.

- UI: `public/index.html`
- API: `POST /api/tanya`
- Quran dataset: Cloudflare KV
- Model: Cloudflare Workers AI

Deployment runs automatically from `.github/workflows/deploy-cloudflare.yml` on pushes to `main`.
Required GitHub secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
