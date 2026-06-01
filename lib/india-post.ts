export const INDIA_POST_TRACKING_PATTERN = /^[A-Z]{2}\d{9}IN$/;

export function normalizeIndiaPostTrackingNumber(input?: string | null): string | null {
  if (!input) return null;
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!cleaned) return null;
  if (!INDIA_POST_TRACKING_PATTERN.test(cleaned)) {
    throw new Error("Invalid India Post tracking number (expected format: EE123456789IN)");
  }
  return cleaned;
}
