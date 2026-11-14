/**
 * @jest-environment node
 */

import { adminPath, getSiteUrl } from "@/lib/hosts";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("adminPath", () => {
  it("keeps the /admin prefix when there is no dedicated admin host", () => {
    delete process.env.NEXT_PUBLIC_ADMIN_HOST;
    expect(adminPath("/")).toBe("/admin");
    expect(adminPath("/login")).toBe("/admin/login");
    expect(adminPath("/shipping-label?bookingId=TTH-0001")).toBe(
      "/admin/shipping-label?bookingId=TTH-0001"
    );
  });

  it("uses clean paths on a dedicated admin host", () => {
    process.env.NEXT_PUBLIC_ADMIN_HOST = "admin.threadtheoryhome.in";
    expect(adminPath("/")).toBe("/");
    expect(adminPath("/login")).toBe("/login");
  });
});

describe("getSiteUrl", () => {
  it("returns the public site URL without a trailing slash", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://threadtheoryhome.in/";
    expect(getSiteUrl()).toBe("https://threadtheoryhome.in");
  });

  it("falls back to localhost when unset", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});
