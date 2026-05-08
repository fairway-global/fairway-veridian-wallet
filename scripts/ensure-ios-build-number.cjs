const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectFilePath = path.join(
  __dirname,
  "..",
  "ios",
  "App",
  "App.xcodeproj",
  "project.pbxproj"
);
const archivesRoot = path.join(
  process.env.HOME || "",
  "Library",
  "Developer",
  "Xcode",
  "Archives"
);

function readProjectSetting(content, key) {
  const match = content.match(new RegExp(`${key} = ([^;]+);`));
  return match ? match[1].trim().replace(/^"|"$/g, "") : null;
}

function plistValue(plistPath, key) {
  try {
    return execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", `Print :ApplicationProperties:${key}`, plistPath],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    return null;
  }
}

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

function newestMatchingArchivedBuild({ bundleId, version }) {
  const matchingBuilds = listArchives(archivesRoot)
    .map((archivePath) => {
      const plistPath = path.join(archivePath, "Info.plist");
      const archiveBundleId = plistValue(plistPath, "CFBundleIdentifier");
      const archiveVersion = plistValue(
        plistPath,
        "CFBundleShortVersionString"
      );
      const archiveBuild = plistValue(plistPath, "CFBundleVersion");

      if (archiveBundleId !== bundleId || archiveVersion !== version) {
        return null;
      }

      const numericBuild = Number(archiveBuild);
      if (!Number.isInteger(numericBuild)) return null;

      return { archivePath, build: numericBuild };
    })
    .filter(Boolean)
    .sort((a, b) => b.build - a.build);

  return matchingBuilds[0] || null;
}

function main() {
  const content = fs.readFileSync(projectFilePath, "utf8");
  const version = readProjectSetting(content, "MARKETING_VERSION");
  const bundleId = readProjectSetting(content, "PRODUCT_BUNDLE_IDENTIFIER");
  const currentBuild = Number(
    readProjectSetting(content, "CURRENT_PROJECT_VERSION")
  );

  if (!version || !bundleId || !Number.isInteger(currentBuild)) {
    console.error(
      "Could not read MARKETING_VERSION, PRODUCT_BUNDLE_IDENTIFIER, or CURRENT_PROJECT_VERSION from project.pbxproj."
    );
    process.exit(1);
  }

  const archivedBuild = newestMatchingArchivedBuild({ bundleId, version });
  if (!archivedBuild) {
    console.log(
      `No local ${bundleId} ${version} archive found. Keeping iOS build ${currentBuild}.`
    );
    return;
  }

  if (currentBuild > archivedBuild.build) {
    console.log(
      `iOS build ${currentBuild} is newer than latest local archive build ${archivedBuild.build}.`
    );
    return;
  }

  const nextBuild = archivedBuild.build + 1;
  fs.writeFileSync(
    projectFilePath,
    content.replace(
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${nextBuild};`
    ),
    "utf8"
  );

  console.log(
    `Updated iOS build ${currentBuild} -> ${nextBuild} because latest local archive is ${version} (${archivedBuild.build}).`
  );
  console.log(`Latest matching archive: ${archivedBuild.archivePath}`);
}

main();
