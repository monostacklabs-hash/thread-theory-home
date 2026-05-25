#!/usr/bin/env node
/**
 * sync-insta.mjs
 *
 * Reads data/insta-posts.json, fetches each Instagram post's public
 * og:image + caption (using the Facebook crawler User-Agent, which IG
 * still serves meta tags to), downloads each thumbnail to public/insta/,
 * and writes public/insta/manifest.json for the landing page to read.
 *
 * Designed to run daily via GitHub Actions. Exits 0 even when individual
 * posts fail — the script never deletes already-synced images, so a
 * transient IG hiccup doesn't take down the grid.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CONFIG_PATH = join(ROOT, "data", "insta-posts.json");
const OUT_DIR = join(ROOT, "public", "insta");
const MANIFEST_PATH = join(ROOT, "data", "insta-manifest.json");

const UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const FETCH_TIMEOUT_MS = 15_000;

function decodeHtmlEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/**
 * Instagram's og:description is wrapped in a noisy preamble:
 *   "4 likes, 0 comments - threadtheoryhome.in on May 21, 2026: \"…actual caption…\""
 * Pull just the captioned text between the outer quotes.
 */
function extractRealCaption(rawDescription) {
  if (!rawDescription) return "";
  const decoded = decodeHtmlEntities(rawDescription);
  const m = decoded.match(/:\s*["“](.+?)["”]\s*$/s);
  if (m) return m[1].trim();
  // Fallback — strip a leading "N likes, M comments - handle on DATE:" if present
  return decoded.replace(/^[^:]*:\s*/, "").replace(/^["“]|["”]$/g, "").trim();
}

function extractMeta(html, property) {
  const re = new RegExp(
    `<meta\\s+property=["']${property}["']\\s+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  return m ? decodeHtmlEntities(m[1]) : null;
}

function shortcodeFromUrl(url) {
  const m = url.match(/\/p\/([^/?#]+)/);
  if (!m) throw new Error(`Could not extract shortcode from ${url}`);
  return m[1];
}

function trimCaption(raw, max = 220) {
  if (!raw) return "";
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max - 1).trimEnd() + "…";
}

async function fetchWithTimeout(url, options = {}, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function syncOne(postUrl) {
  const shortcode = shortcodeFromUrl(postUrl);
  const htmlRes = await fetchWithTimeout(postUrl, { headers: { "User-Agent": UA } });
  if (!htmlRes.ok) {
    throw new Error(`HTTP ${htmlRes.status} fetching post HTML`);
  }
  const html = await htmlRes.text();

  const imageUrl = extractMeta(html, "og:image");
  const description = extractMeta(html, "og:description") || "";
  const title = extractMeta(html, "og:title") || "";

  if (!imageUrl) {
    throw new Error("og:image not found in HTML (Instagram may have changed format)");
  }

  const imgRes = await fetchWithTimeout(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`HTTP ${imgRes.status} fetching image bytes`);
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());

  const localPath = join(OUT_DIR, `${shortcode}.jpg`);
  await writeFile(localPath, buf);

  return {
    shortcode,
    url: postUrl,
    image: `/insta/${shortcode}.jpg`,
    caption: trimCaption(extractRealCaption(description)),
    bytes: buf.length,
    fetchedAt: new Date().toISOString()
  };
}

async function main() {
  if (!existsSync(CONFIG_PATH)) {
    console.error(`Missing ${CONFIG_PATH}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(dirname(MANIFEST_PATH), { recursive: true });

  const config = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const posts = Array.isArray(config.posts) ? config.posts : [];
  if (posts.length === 0) {
    console.warn("No posts configured. Nothing to do.");
    return;
  }

  let priorManifest = [];
  if (existsSync(MANIFEST_PATH)) {
    try {
      priorManifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
    } catch {
      priorManifest = [];
    }
  }
  const priorByShortcode = new Map(
    Array.isArray(priorManifest) ? priorManifest.map((p) => [p.shortcode, p]) : []
  );

  const next = [];
  let okCount = 0;
  let failCount = 0;

  for (const postUrl of posts) {
    const shortcode = shortcodeFromUrl(postUrl);
    try {
      console.log(`→ ${shortcode}`);
      const entry = await syncOne(postUrl);
      next.push(entry);
      okCount++;
      console.log(`  ✓ ${entry.bytes} bytes${entry.caption ? ` — "${entry.caption.slice(0, 60)}…"` : ""}`);
    } catch (err) {
      failCount++;
      const fallback = priorByShortcode.get(shortcode);
      if (fallback) {
        next.push(fallback);
        console.warn(`  ⚠ failed: ${err.message} — kept prior entry`);
      } else {
        console.warn(`  ✗ failed: ${err.message} — skipped (no prior entry)`);
      }
    }
  }

  await writeFile(MANIFEST_PATH, JSON.stringify(next, null, 2) + "\n");
  console.log(`\nSynced ${okCount}/${posts.length} (${failCount} failed). Manifest: ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
