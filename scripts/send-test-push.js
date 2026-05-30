/* eslint-disable */
// One-off diagnostic: send a status push directly via firebase-admin,
// bypassing the browser admin tab. Usage: node scripts/send-test-push.js [bookingId] [status]
const fs = require("fs");
const path = require("path");

// Minimal .env.local loader (no dotenv dependency).
const envPath = path.join(__dirname, "..", ".env.local");
for (const rawLine of fs.readFileSync(envPath, "utf8").split("\n")) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const eq = line.indexOf("=");
  if (eq === -1) continue;
  const key = line.slice(0, eq).trim();
  let val = line.slice(eq + 1).trim();
  if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
  if (!(key in process.env)) process.env[key] = val;
}

const { cert, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

const bookingId = process.argv[2] || "TTH-0004";
const status = process.argv[3] || "shipped";

const NOTIFS = {
  confirmed: { title: "Order confirmed", body: "We've accepted your order. Packing soon." },
  preparing: { title: "Preparing your order", body: "Your bedsheets are being folded and packed." },
  shipped: { title: "On the way", body: "Your parcel is with the courier. Tap to track." },
  delivered: { title: "Delivered", body: "Hope you love your bedsheets. Thanks for choosing us." }
};

(async () => {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });

  const db = getFirestore();
  const bookingSnap = await db.collection("bookings").doc(bookingId).get();
  const token = bookingSnap.data() && bookingSnap.data().token;
  const subs = await db.collection("bookings").doc(bookingId).collection("fcmTokens").get();
  const tokens = subs.docs.map((d) => d.data().token);
  console.log(`booking=${bookingId} status=${status} tokensFound=${tokens.length}`);
  if (tokens.length === 0) {
    console.log("No tokens stored — subscribe in the customer tab first.");
    process.exit(0);
  }

  const link = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/order/${bookingId}?token=${token}`;
  const res = await getMessaging().sendEachForMulticast({
    tokens,
    notification: NOTIFS[status],
    webpush: { fcmOptions: { link } }
  });
  console.log(`successCount=${res.successCount} failureCount=${res.failureCount}`);
  res.responses.forEach((r, i) => {
    if (!r.success) console.log(`  token[${i}] error: ${r.error && r.error.code}`);
  });
  process.exit(0);
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
