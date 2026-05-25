const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function loadEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

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
    env[key] = value;
  }

  return env;
}

const envFile = path.join(process.cwd(), ".env.local");
const env = loadEnvFile(envFile);
env.NEXT_PUBLIC_SITE_URL = "https://thread-theory-home.vercel.app";

const args = ["vercel", "deploy", "--prod", "--yes"];

for (const [key, value] of Object.entries(env)) {
  args.push("-b", `${key}=${value}`);
  args.push("-e", `${key}=${value}`);
}

const child = spawn("npx", args, {
  cwd: process.cwd(),
  stdio: "inherit",
  shell: false
});

child.on("exit", (code) => {
  process.exit(code || 0);
});
