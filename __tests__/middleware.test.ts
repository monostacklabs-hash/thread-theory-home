/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const ADMIN_HOST = "admin.threadtheoryhome.in";
const SITE_HOST = "threadtheoryhome.in";
const SESSION = "tth_admin_session=abc";

function run(host: string, path: string, cookie?: string) {
  const headers: Record<string, string> = { host };
  if (cookie) headers.cookie = cookie;
  return middleware(new NextRequest(`https://${host}${path}`, { headers }));
}

function rewriteTarget(response: Response) {
  const value = response.headers.get("x-middleware-rewrite");
  return value ? new URL(value).pathname + new URL(value).search : null;
}

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("middleware with a dedicated admin host", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_ADMIN_HOST = ADMIN_HOST;
    process.env.NEXT_PUBLIC_SITE_URL = `https://${SITE_HOST}`;
  });

  describe("on the public host", () => {
    it("sends /admin to the admin host root", () => {
      const response = run(SITE_HOST, "/admin");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`https://${ADMIN_HOST}/`);
    });

    it("sends nested admin paths to the admin host, keeping the query", () => {
      const response = run(SITE_HOST, "/admin/shipping-label?bookingId=TTH-0001");
      expect(response.headers.get("location")).toBe(
        `https://${ADMIN_HOST}/shipping-label?bookingId=TTH-0001`
      );
    });

    it("does not serve the admin session API", () => {
      expect(run(SITE_HOST, "/api/admin/session").status).toBe(404);
    });

    it("leaves public pages and public APIs alone", () => {
      for (const path of ["/", "/faq", "/order/TTH-0001?token=x", "/api/bookings/TTH-0001/subscriptions"]) {
        const response = run(SITE_HOST, path);
        expect(response.headers.get("x-middleware-next")).toBe("1");
      }
    });

    it("does not treat look-alike paths as admin paths", () => {
      expect(run(SITE_HOST, "/administrator").headers.get("x-middleware-next")).toBe("1");
    });
  });

  describe("on the admin host", () => {
    it("sends a signed-out visitor to /login", () => {
      const response = run(ADMIN_HOST, "/");
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`https://${ADMIN_HOST}/login`);
    });

    it("serves the dashboard at the root for a signed-in visitor", () => {
      const response = run(ADMIN_HOST, "/", SESSION);
      expect(rewriteTarget(response)).toBe("/admin");
    });

    it("serves the login page without a session", () => {
      expect(rewriteTarget(run(ADMIN_HOST, "/login"))).toBe("/admin/login");
    });

    it("serves the shipping label page with its query", () => {
      const response = run(ADMIN_HOST, "/shipping-label?bookingId=TTH-0001", SESSION);
      expect(rewriteTarget(response)).toBe("/admin/shipping-label?bookingId=TTH-0001");
    });

    it("protects the shipping label page", () => {
      const response = run(ADMIN_HOST, "/shipping-label");
      expect(response.headers.get("location")).toBe(`https://${ADMIN_HOST}/login`);
    });

    it("redirects old /admin paths to the clean path", () => {
      expect(run(ADMIN_HOST, "/admin", SESSION).headers.get("location")).toBe(`https://${ADMIN_HOST}/`);
      expect(run(ADMIN_HOST, "/admin/login").headers.get("location")).toBe(
        `https://${ADMIN_HOST}/login`
      );
    });

    it("lets API calls through", () => {
      for (const path of ["/api/admin/session", "/api/bookings", "/api/bookings/TTH-0001"]) {
        expect(run(ADMIN_HOST, path, SESSION).headers.get("x-middleware-next")).toBe("1");
      }
    });

    it("sends public pages back to the public site", () => {
      const response = run(ADMIN_HOST, "/order/TTH-0001?token=x", SESSION);
      expect(response.headers.get("location")).toBe(`https://${SITE_HOST}/order/TTH-0001?token=x`);
    });

    it("tells crawlers to stay out", async () => {
      const response = run(ADMIN_HOST, "/robots.txt");
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Disallow: /");
      expect(run(ADMIN_HOST, "/login").headers.get("x-robots-tag")).toContain("noindex");
    });

    it("matches the host case-insensitively", () => {
      expect(rewriteTarget(run("Admin.ThreadTheoryHome.in", "/login"))).toBe("/admin/login");
    });
  });
});

describe("middleware without a dedicated admin host", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_ADMIN_HOST;
  });

  it("keeps protecting /admin by path", () => {
    const response = run("localhost:3000", "/admin");
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/admin/login");
  });

  it("lets a signed-in visitor reach /admin", () => {
    expect(run("localhost:3000", "/admin", SESSION).headers.get("x-middleware-next")).toBe("1");
  });

  it("serves /admin/login without a session", () => {
    expect(run("localhost:3000", "/admin/login").headers.get("x-middleware-next")).toBe("1");
  });

  it("leaves public pages alone", () => {
    expect(run("localhost:3000", "/faq").headers.get("x-middleware-next")).toBe("1");
  });
});
