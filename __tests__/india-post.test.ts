import { normalizeIndiaPostTrackingNumber } from "@/lib/india-post";

describe("normalizeIndiaPostTrackingNumber", () => {
  it("accepts a valid number unchanged", () => {
    expect(normalizeIndiaPostTrackingNumber("EE123456789IN")).toBe("EE123456789IN");
  });

  it("uppercases and strips internal/edge whitespace", () => {
    expect(normalizeIndiaPostTrackingNumber(" el 779157602 in ")).toBe("EL779157602IN");
  });

  it("returns null for empty or nullish input", () => {
    expect(normalizeIndiaPostTrackingNumber("")).toBeNull();
    expect(normalizeIndiaPostTrackingNumber(null)).toBeNull();
    expect(normalizeIndiaPostTrackingNumber(undefined)).toBeNull();
  });

  it("throws on the wrong format", () => {
    expect(() => normalizeIndiaPostTrackingNumber("12345")).toThrow();
    expect(() => normalizeIndiaPostTrackingNumber("EEE12345678IN")).toThrow();
  });
});
