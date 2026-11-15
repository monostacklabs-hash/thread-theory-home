/**
 * Minimal local declarations for the Workers runtime types this Worker uses,
 * so the project type-checks without @cloudflare/workers-types.
 */
import type { TokenCacheStore } from "@/lib/firebase/google-auth";

export type Env = {
  /** Static assets built by `next build` into out/. */
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** KV namespace holding the Google access token. Optional at runtime. */
  TOKEN_CACHE?: TokenCacheStore;
  SITE_URL?: string;
  ADMIN_HOST?: string;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
  ADMIN_EMAILS?: string;
  SESSION_SECRET?: string;
};

export type ExecutionContext = {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
};
