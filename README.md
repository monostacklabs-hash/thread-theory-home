# Thread Theory Home

Minimal, production-ready web system for an Instagram-led bedsheet business.

## Architecture

The system is intentionally small:

- Landing page is a public, fast Next.js App Router page focused on trust and Instagram DM conversion.
- Every page is a static file. `next build` runs with `output: "export"` and writes `out/`; pages that need data (order tracking, the admin dashboard, shipping labels) load it in the browser from the API.
- The API is a small Cloudflare Worker in `worker/` (plain fetch handler, no framework). It serves `/api/*`, redirects the customer link format `/order/TTH-0001?token=…` to the static `/order` page, and handles the admin host. Cloudflare serves everything else straight from `out/` without running the Worker.
- This split exists because the Workers Free plan allows 10 ms of CPU per request. Server-rendering the app in a Worker measured 25-100 ms per cold request; the API Worker measures 1-5 ms.
- Server-side Firebase access (`lib/firebase/`) uses Google's REST APIs, because the `firebase-admin` SDK does not run on Workers. The Google access token is cached in Workers KV so most requests never sign one. `firebase-admin` is kept only for the Node maintenance scripts in `scripts/`.
- Admin sign-in: the browser signs in with Firebase Auth, the Worker verifies the ID token and the `ADMIN_EMAILS` allowlist, then sets its own HMAC-signed, HTTP-only session cookie (5 days).
- The order-tracking API masks personal details on the server; the raw name, phone, email and address never reach the browser.
- When the Worker variable `ADMIN_HOST` is set (for example `admin.threadtheoryhome.in`), that host serves the dashboard at `/`, sign-in at `/login` and labels at `/shipping-label`. `/admin/*` on any host redirects to those addresses, the admin API only answers on the admin host, and the admin host is marked noindex. When it is empty, admin is served under `/admin` on any host.

## Folder structure

```text
app/
  api/
    admin/
      logout/route.ts
      session/route.ts
    bookings/
      [bookingId]/route.ts
      route.ts
  admin/
    login/page.tsx
    page.tsx
  order/[bookingId]/page.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  admin/
    booking-form.tsx
    bookings-table.tsx
    login-form.tsx
lib/
  firebase/
    admin.ts
    client.ts
  auth.ts
  bookings.ts
  types.ts
public/
  products/
    dune.svg
    ivory.svg
    sage.svg
middleware.ts
```

## Database schema

Collection: `bookings`

Document ID: `bookingId` such as `TTH-0001`

Fields:

- `bookingId: string`
- `name: string`
- `phone: string`
- `email: string | null`
- `address: string`
- `product: string`
- `notes: string`
- `status: "order_received" | "confirmed" | "preparing" | "shipped" | "delivered" | "cancelled"`
- `token: string`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

Counter document:

- `meta/counters`
- `bookingCount: number`

## API routes

- `POST /api/admin/session`
  Exchanges a Firebase ID token for a secure admin session cookie.
- `POST /api/admin/logout`
  Clears the admin session cookie.
- `POST /api/bookings`
  Creates a booking, increments the booking counter, generates a token, and returns a tracking URL.
- `PATCH /api/bookings/[bookingId]`
  Updates booking status and optional notes.

## Firebase deployment

1. Create a Firebase project.
2. Enable Firestore and Firebase Authentication with Email/Password.
3. Create the admin user in Firebase Auth using one of the emails listed in `ADMIN_EMAILS`.
4. Generate a Firebase service account and map its values into `.env.local` for local work.
5. Deploy Firestore config:

```bash
npx firebase-tools deploy --only firestore
```

6. Create a Firebase App Hosting backend in the Firebase console and connect this repository.
7. Add the secrets referenced in `apphosting.yaml` to App Hosting.
8. Set `NEXT_PUBLIC_SITE_URL` to the final App Hosting domain or your custom domain.

## Cloudflare Workers deployment

```bash
npm run build:cf     # static export into out/, public values from .env.production
npm run preview:cf   # run the Worker and static files locally (secrets from .dev.vars)
npm run deploy:cf    # build and deploy
```

- Public build-time values live in `.env.production` (committed, no secrets).
- Worker variables are in `wrangler.jsonc`: `SITE_URL`, `ADMIN_HOST`.
- Worker secrets are set once with `npx wrangler secret put <NAME>`: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ADMIN_EMAILS`, `SESSION_SECRET` (any long random string; changing it signs every admin out). For local runs, put the same names in `.dev.vars`.
- `.github/workflows/deploy-cloudflare.yml` deploys on push to `main` and after the daily Instagram sync. It only runs when the repository variable `CLOUDFLARE_DEPLOY` is `true`, and needs the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Local development

```bash
npm install
cp .env.local .dev.vars   # Worker secrets for local runs (add SESSION_SECRET)
npm run dev:api           # API Worker on http://localhost:8787
npm run dev               # pages on http://localhost:3000, /api proxied to the Worker
```

Open `http://localhost:3000`.
