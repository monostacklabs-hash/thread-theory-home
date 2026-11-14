/**
 * Cloudflare Worker for Thread Theory Home.
 *
 * Pages are static files (out/, served by the ASSETS binding). This Worker
 * only handles host routing, the legacy /order/<id> link, and /api/*.
 * It deliberately uses no framework: a free-plan Worker gets 10 ms of CPU.
 */
import { setTokenCache } from "@/lib/firebase/google-auth";
import { handleApi, json } from "./api";
import type { Env, ExecutionContext } from "./env";

const NOINDEX = "noindex, nofollow";
const PROCESS_ENV_KEYS = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"] as const;

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function redirect(location: string) {
  return new Response(null, { status: 302, headers: { location } });
}

/**
 * lib/firebase and lib/push read their settings from process.env. Workers
 * fills it from vars and secrets; this covers runtimes that do not, and maps
 * SITE_URL onto the name lib/push uses for the notification link.
 */
function syncProcessEnv(env: Env) {
  for (const key of PROCESS_ENV_KEYS) {
    const value = env[key];
    if (typeof value === "string" && process.env[key] === undefined) process.env[key] = value;
  }
  if (env.SITE_URL) process.env.NEXT_PUBLIC_SITE_URL = env.SITE_URL;
}

/** /order/TTH-0001?token=abc is the link already sent to customers. */
function legacyOrderRedirect(request: Request, url: URL): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const match = /^\/order\/([^/]+)\/?$/.exec(url.pathname);
  // A dot means a file of the static /order page (index.html, index.txt), not a booking id.
  if (!match || match[1].includes(".")) return null;

  let bookingId: string;
  try {
    bookingId = decodeURIComponent(match[1]);
  } catch {
    return null;
  }

  const query = new URLSearchParams({ id: bookingId });
  const token = url.searchParams.get("token");
  if (token) query.set("token", token);
  return redirect(`/order?${query}`);
}

async function route(request: Request, env: Env, ctx: ExecutionContext, url: URL, onAdminHost: boolean) {
  const { pathname, search } = url;
  const adminHost = (env.ADMIN_HOST || "").trim().toLowerCase();

  if (adminHost) {
    if (onAdminHost) {
      if (pathname === "/robots.txt" && request.method === "GET") {
        return new Response("User-agent: *\nDisallow: /\n", {
          headers: { "content-type": "text/plain; charset=utf-8" }
        });
      }
      if (pathname === "/") return redirect("/admin");
    } else {
      if (isAdminPath(pathname)) return redirect(`https://${adminHost}${pathname}${search}`);
      if (pathname.startsWith("/api/admin/")) return json({ error: "Not found" }, 404);
    }
  }

  const orderRedirect = legacyOrderRedirect(request, url);
  if (orderRedirect) return orderRedirect;

  if (pathname.startsWith("/api/")) {
    return handleApi(request, env, ctx, url);
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    syncProcessEnv(env);
    setTokenCache(env.TOKEN_CACHE);

    const url = new URL(request.url);
    const adminHost = (env.ADMIN_HOST || "").trim().toLowerCase();
    const host = (request.headers.get("host") || url.host).toLowerCase();
    const onAdminHost = Boolean(adminHost) && host === adminHost;

    const response = await route(request, env, ctx, url, onAdminHost);
    if (!onAdminHost) return response;

    // Asset responses have immutable headers, so copy before adding ours.
    const tagged = new Response(response.body, response);
    tagged.headers.set("x-robots-tag", NOINDEX);
    return tagged;
  }
};
