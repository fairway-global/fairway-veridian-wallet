const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ARCHIVES_ROOT = path.join(
  process.env.HOME || "",
  "Library",
  "Developer",
  "Xcode",
  "Archives"
);

function listArchives(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".xcarchive")) {
      results.push(fullPath);
      continue;
    }
    if (entry.isDirectory()) {
      results.push(...listArchives(fullPath));
    }
  }
  return results;
}

function getNewestArchive() {
  const archives = listArchives(ARCHIVES_ROOT);
  if (!archives.length) return null;

  archives.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return archives[0];
}

function getUuids(binaryPath) {
  if (!fs.existsSync(binaryPath)) return [];
  try {
    const output = execSync(`xcrun dwarfdump --uuid "${binaryPath}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return [...output.matchAll(/UUID:\s+([0-9A-F-]{36})/gi)].map((m) =>
      m[1].toUpperCase()
    );
  } catch {
    return [];
  }
}

function hasUuidOverlap(a, b) {
  const set = new Set(a);
  return b.some((uuid) => set.has(uuid));
}

function main() {
  const archive = getNewestArchive();
  if (!archive) {
    console.error(
      "No .xcarchive found under ~/Library/Developer/Xcode/Archives"
    );
    process.exit(1);
  }

  const appBinary = path.join(
    archive,
    "Products",
    "Applications",
    "App.app",
    "App"
  );
  const appDsymDwarf = path.join(
    archive,
    "dSYMs",
    "App.app.dSYM",
    "Contents",
    "Resources",
    "DWARF",
    "App"
  );
  const talsecDsym = path.join(
    archive,
    "dSYMs",
    "TalsecRuntime.framework.dSYM"
  );
  const talsecBinary = path.join(
    archive,
    "Products",
    "Applications",
    "App.app",
    "Frameworks",
    "TalsecRuntime.framework",
    "TalsecRuntime"
  );
  const talsecDsymDwarf = path.join(
    talsecDsym,
    "Contents",
    "Resources",
    "DWARF",
    "TalsecRuntime"
  );

  console.log(`Using archive: ${archive}`);

  if (!fs.existsSync(appDsymDwarf)) {
    console.error(
      "Missing App.app.dSYM. Fix Release build settings: DEBUG_INFORMATION_FORMAT=dwarf-with-dsym and GCC_GENERATE_DEBUGGING_SYMBOLS=YES."
    );
    process.exit(1);
  }

  const appBinaryUuids = getUuids(appBinary);
  const appDsymUuids = getUuids(appDsymDwarf);
  if (
    appBinaryUuids.length &&
    appDsymUuids.length &&
    !hasUuidOverlap(appBinaryUuids, appDsymUuids)
  ) {
    console.error(
      "App dSYM UUID mismatch with App binary. Re-archive after Product > Clean Build Folder."
    );
    process.exit(1);
  }

  console.log("App.app.dSYM looks valid.");

  if (!fs.existsSync(talsecDsym)) {
    console.error(
      "Missing TalsecRuntime.framework.dSYM. Run npm run ios:fix-latest-archive-symbols, or re-archive in Xcode with the Generate TalsecRuntime dSYM build phase enabled."
    );
    process.exit(1);
  }

  const talsecBinaryUuids = getUuids(talsecBinary);
  const talsecDsymUuids = getUuids(talsecDsymDwarf);
  if (
    talsecBinaryUuids.length &&
    talsecDsymUuids.length &&
    !hasUuidOverlap(talsecBinaryUuids, talsecDsymUuids)
  ) {
    console.error(
      "TalsecRuntime.framework.dSYM UUID mismatch with the embedded TalsecRuntime.framework binary."
    );
    process.exit(1);
  } else {
    console.log("TalsecRuntime.framework.dSYM looks valid.");
  }
}

main();
