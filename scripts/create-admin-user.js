const fs = require("fs");
const path = require("path");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

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

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    })
  });

  const email = "admin@threadtheoryhome.in";
  const password = "TthAdmin2026Pass";

  try {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().updateUser(user.uid, {
      password,
      emailVerified: true
    });
    console.log(`RESET ${email} ${password}`);
  } catch {
    const user = await getAuth().createUser({
      email,
      password,
      emailVerified: true
    });
    console.log(`CREATED ${user.uid} ${email} ${password}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
