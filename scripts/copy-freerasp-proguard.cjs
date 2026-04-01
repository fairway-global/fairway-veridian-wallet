const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(
  repoRoot,
  "android",
  "proguard-overwrites",
  "proguard-rules.pro"
);
const targetPath = path.join(
  repoRoot,
  "node_modules",
  "capacitor-freerasp",
  "android",
  "proguard-rules.pro"
);

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing source ProGuard rules: ${sourcePath}`);
}

const targetDir = path.dirname(targetPath);

if (!fs.existsSync(targetDir)) {
  console.log(
    "capacitor-freerasp is not installed yet. Skipping ProGuard patch copy."
  );
  process.exit(0);
}

fs.copyFileSync(sourcePath, targetPath);
console.log(`Copied freerasp ProGuard rules into ${targetPath}`);
