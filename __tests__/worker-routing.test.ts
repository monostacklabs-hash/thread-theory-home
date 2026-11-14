/** @jest-environment node */

jest.mock("@/lib/firebase/admin", () => ({
  getAdminDb: jest.fn(() => {
    throw new Error("Firestore must not be reached in routing tests");
  })
}));

import worker from "@/worker/index";
import type { Env } from "@/worker/env";

const ADMIN_HOST = "admin.threadtheoryhome.in";
const PUBLIC_HOST = "threadtheoryhome.in";

function makeEnv(adminHost: string | undefined) {
  const assets = jest.fn(async () => new Response("asset body", { headers: { "content-type": "text/html" } }));
  const env: Env = {
    ASSETS: { fetch: assets },
    SITE_URL: "https://threadtheoryhome.in",
    ADMIN_HOST: adminHost
  };
  return { env, assets };
}

function fetchFrom(env: Env, host: string, path: string, method = "GET") {
  const request = new Request(`https://${host}${path}`, { method, headers: { host } });
  return worker.fetch(request, env, { waitUntil: jest.fn() });
}

describe("admin host", () => {
  it("serves a disallow-all robots.txt", async () => {
    const { env, assets } = makeEnv(ADMIN_HOST);
    const response = await fetchFrom(env, ADMIN_HOST, "/robots.txt");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("User-agent: *\nDisallow: /\n");
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(assets).not.toHaveBeenCalled();
  });

  it("redirects / to /admin", async () => {
    const { env } = makeEnv(ADMIN_HOST);
    const response = await fetchFrom(env, ADMIN_HOST, "/");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("serves admin pages from assets with a noindex header", async () => {
    const { env, assets } = makeEnv(ADMIN_HOST);
    const response = await fetchFrom(env, ADMIN_HOST, "/admin/login");

    expect(assets).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe("asset body");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("matches the host header case-insensitively", async () => {
    const { env } = makeEnv("Admin.ThreadTheoryHome.in");
    const request = new Request("https://admin.threadtheoryhome.in/", {
      headers: { host: "ADMIN.threadtheoryhome.in" }
    });
    const response = await worker.fetch(request, env, { waitUntil: jest.fn() });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/admin");
  });

  it("serves the admin API (401 without a cookie, with noindex)", async () => {
    const { env } = makeEnv(ADMIN_HOST);
    const response = await fetchFrom(env, ADMIN_HOST, "/api/admin/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });
});

describe("public host with an admin host configured", () => {
  it.each([
    ["/admin", "https://admin.threadtheoryhome.in/admin"],
    ["/admin/login", "https://admin.threadtheoryhome.in/admin/login"],
    ["/admin/shipping-label?id=TTH-0001&x=1", "https://admin.threadtheoryhome.in/admin/shipping-label?id=TTH-0001&x=1"]
  ])("redirects %s to the admin host", async (path, location) => {
    const { env, assets } = makeEnv(ADMIN_HOST);
    const response = await fetchFrom(env, PUBLIC_HOST, path);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(location);
    expect(assets).not.toHaveBeenCalled();
  });

  it("hides the admin API", async () => {
    const { env } = makeEnv(ADMIN_HOST);
    const response = await fetchFrom(env, PUBLIC_HOST, "/api/admin/me");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  });

  it("does not treat /administrator as an admin path", async () => {
    const { env, assets } = makeEnv(ADMIN_HOST);
    await fetchFrom(env, PUBLIC_HOST, "/administrator");
    expect(assets).toHaveBeenCalledTimes(1);
  });

  it("serves public pages and robots.txt from assets without a noindex header", async () => {
    const { env, assets } = makeEnv(ADMIN_HOST);
    const home = await fetchFrom(env, PUBLIC_HOST, "/");
    const robots = await fetchFrom(env, PUBLIC_HOST, "/robots.txt");

    expect(assets).toHaveBeenCalledTimes(2);
    expect(home.headers.get("x-robots-tag")).toBeNull();
    expect(robots.headers.get("x-robots-tag")).toBeNull();
  });
});

describe.each([["unset", undefined], ["empty", ""]])("ADMIN_HOST %s", (_label, adminHost) => {
  it("serves admin pages from assets on any host", async () => {
    const { env, assets } = makeEnv(adminHost);
    const response = await fetchFrom(env, "localhost:8787", "/admin");

    expect(assets).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toBeNull();
  });

  it("serves the admin API on any host", async () => {
    const { env } = makeEnv(adminHost);
    const response = await fetchFrom(env, "localhost:8787", "/api/admin/me");
    expect(response.status).toBe(401);
  });

  it("serves / and robots.txt from assets", async () => {
    const { env, assets } = makeEnv(adminHost);
    await fetchFrom(env, "localhost:8787", "/");
    await fetchFrom(env, "localhost:8787", "/robots.txt");
    expect(assets).toHaveBeenCalledTimes(2);
  });
});

describe("legacy order links", () => {
  it("redirects /order/<id>?token= to the static order page", async () => {
    const { env, assets } = makeEnv("");
    const response = await fetchFrom(env, PUBLIC_HOST, "/order/TTH-0001?token=abc&utm_source=ig");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/order?id=TTH-0001&token=abc");
    expect(assets).not.toHaveBeenCalled();
  });

  it("URL-encodes the id and token", async () => {
    const { env } = makeEnv("");
    const response = await fetchFrom(env, PUBLIC_HOST, "/order/TTH%200001?token=a%26b%3Dc");

    expect(response.headers.get("location")).toBe("/order?id=TTH+0001&token=a%26b%3Dc");
  });

  it("omits the token when the link has none", async () => {
    const { env } = makeEnv("");
    const response = await fetchFrom(env, PUBLIC_HOST, "/order/TTH-0001");
    expect(response.headers.get("location")).toBe("/order?id=TTH-0001");
  });

  it.each(["/order", "/order/", "/order?id=TTH-0001&token=abc", "/order/index.txt", "/order/a/b"])(
    "leaves %s to assets",
    async (path) => {
      const { env, assets } = makeEnv("");
      const response = await fetchFrom(env, PUBLIC_HOST, path);

      expect(response.status).toBe(200);
      expect(assets).toHaveBeenCalledTimes(1);
    }
  );
});

describe("API routing", () => {
  it("returns 404 JSON for an unknown API path", async () => {
    const { env, assets } = makeEnv("");
    const response = await fetchFrom(env, PUBLIC_HOST, "/api/nope");

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(assets).not.toHaveBeenCalled();
  });

  it("returns 405 JSON for a known path with the wrong method", async () => {
    const { env } = makeEnv("");
    const response = await fetchFrom(env, PUBLIC_HOST, "/api/admin/logout", "GET");

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.json()).toEqual({ error: "Method not allowed" });
  });

  it("returns 500 JSON when a handler throws", async () => {
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const { env } = makeEnv("");
    // The Firestore mock throws, which stands in for any unexpected failure.
    const response = await fetchFrom(env, PUBLIC_HOST, "/api/orders/TTH-0001?token=abc");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal error" });
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("passes everything else to assets untouched", async () => {
    const { env, assets } = makeEnv("");
    const request = new Request(`https://${PUBLIC_HOST}/privacy`, { headers: { host: PUBLIC_HOST } });
    await worker.fetch(request, env, { waitUntil: jest.fn() });

    expect(assets).toHaveBeenCalledWith(request);
  });
});
