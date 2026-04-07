import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Replicate __dirname using import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the envfile.js file in the public directory
const envFilePath = join(__dirname, "../public/envfile.js");

const envCandidates = [
  join(__dirname, "../.env.local"),
  join(__dirname, "../.env"),
  join(__dirname, "../../credential-server/.env"),
];

function hydrateProcessEnvFromFiles() {
  for (const envPath of envCandidates) {
    if (!existsSync(envPath)) {
      continue;
    }

    const content = readFileSync(envPath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

hydrateProcessEnvFromFiles();

// Get the server URL from env or use a default value
const serverUrl =
  process.env.SERVER_URL || process.env.VITE_SERVER_URL || "http://localhost:3001";
const googleClientId =
  process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";

// Content to write to envfile.js
const content = `window.__RUNTIME_CONFIG__ = {
  SERVER_URL: "${serverUrl}",
  GOOGLE_CLIENT_ID: "${googleClientId}"
};`;

// Write the content to envfile.js
writeFileSync(envFilePath, content, "utf8");
console.log(
  `Updated envfile.js with SERVER_URL: ${serverUrl} and GOOGLE_CLIENT_ID: ${googleClientId ? "[set]" : "[empty]"}`
);
