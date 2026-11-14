const fs = require("fs");
const path = require("path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

function loadEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index);
    let value = line.slice(index + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      })
    });
  }

  const db = getFirestore();
  const bookingsSnap = await db.collection("bookings").orderBy("createdAt", "desc").limit(5).get();
  const counterSnap = await db.collection("meta").doc("counters").get();

  const bookings = bookingsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      bookingId: data.bookingId,
      name: data.name,
      phone: data.phone,
      email: data.email || null,
      product: data.product,
      notes: data.notes || "",
      status: data.status,
      tokenPresent: Boolean(data.token),
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null
    };
  });

  console.log(
    JSON.stringify(
      {
        bookings,
        counters: counterSnap.exists ? counterSnap.data() : null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
