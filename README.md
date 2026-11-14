# Thread Theory Home

Minimal, production-ready web system for an Instagram-led bedsheet business.

## Architecture

The system is intentionally small:

- Landing page is a public, fast Next.js App Router page focused on trust and Instagram DM conversion.
- Admin login uses Firebase Auth email/password in the browser only to obtain an ID token.
- A server route exchanges that ID token for a secure HTTP-only session cookie after validating the admin email allowlist.
- Admin booking creation and status updates run through Next.js route handlers. Server-side Firebase access (`lib/firebase/`) goes through Google's REST APIs rather than the `firebase-admin` SDK, because that SDK does not run on Cloudflare Workers. `firebase-admin` is kept only for the Node maintenance scripts in `scripts/`.
- The admin area can be served from its own host. When `NEXT_PUBLIC_ADMIN_HOST` is set (for example `admin.threadtheoryhome.in`), `middleware.ts` serves the dashboard at `/`, `/login` and `/shipping-label` on that host, redirects `/admin/*` on the public host to it, and sends public pages on the admin host back to the public site. When it is unset, admin stays under `/admin`.
- Customer tracking is a public server-rendered page at `/order/[bookingId]?token=...` with no customer auth.
- Firestore stores a small set of booking documents keyed by `bookingId`, which keeps reads and updates simple.

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

The app builds for Cloudflare Workers with [vinext](https://github.com/cloudflare/vinext) (`vite.config.ts`, `wrangler.jsonc`). The regular Next.js build (`npm run build`) still works, so the same code also runs on Vercel.

```bash
npm run build:cf     # production build, public values from .env.production
npm run preview:cf   # run the built Worker locally (secrets from .dev.vars)
npm run deploy:cf    # build and deploy
```

- Public build-time values live in `.env.production` (committed, no secrets). A local `.env.local` overrides it for plain `vite build`, which is why `build:cf` loads `.env.production` explicitly.
- Server secrets are set once on the Worker: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `ADMIN_EMAILS` (`npx wrangler secret put <NAME>`). For `preview:cf`, copy `.env.local` to `.dev.vars`.
- Custom domains are listed (commented out) in `wrangler.jsonc`; they need `threadtheoryhome.in` to be an active zone on the Cloudflare account.
- The Workers Free plan limits each request to 10 ms of CPU, which server-rendering this app exceeds (requests fail with error 1102). Production needs the Workers Paid plan.
- `.github/workflows/deploy-cloudflare.yml` deploys on push to `main` and after the daily Instagram sync. It only runs when the repository variable `CLOUDFLARE_DEPLOY` is `true`, and needs the secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
