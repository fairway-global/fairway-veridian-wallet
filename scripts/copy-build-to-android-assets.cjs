const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourceDir = path.join(repoRoot, "build");
const targetDir = path.join(
  repoRoot,
  "android",
  "app",
  "src",
  "main",
  "assets",
  "public"
);

if (!fs.existsSync(sourceDir)) {
  throw new Error(`Build directory not found: ${sourceDir}`);
}

fs.mkdirSync(targetDir, { recursive: true });

for (const entry of fs.readdirSync(sourceDir)) {
  const sourcePath = path.join(sourceDir, entry);
  const targetPath = path.join(targetDir, entry);
  fs.cpSync(sourcePath, targetPath, {
    force: true,
    recursive: true,
  });
}

const requiredFiles = ["index.html", "main.bundle.js"];
const missingFiles = requiredFiles.filter(
  (file) => !fs.existsSync(path.join(targetDir, file))
);

if (missingFiles.length) {
  throw new Error(
    `Android asset copy incomplete. Missing: ${missingFiles.join(", ")}`
  );
}

console.log(`Copied build assets into ${targetDir}`);
