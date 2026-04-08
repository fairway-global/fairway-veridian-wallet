const fs = require("fs");
const path = require("path");

const projectFilePath = path.join(
  __dirname,
  "..",
  "ios",
  "App",
  "App.xcodeproj",
  "project.pbxproj"
);

const args = process.argv.slice(2);

const hasFlag = (flag) => args.includes(flag);
const getArgValue = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return null;
  return args[index + 1];
};

const printUsageAndExit = () => {
  console.error(
    [
      "Usage:",
      "  node scripts/set-ios-version.cjs --version <marketing_version> --build <build_number>",
      "  node scripts/set-ios-version.cjs --version <marketing_version>",
      "  node scripts/set-ios-version.cjs --build <build_number>",
      "  node scripts/set-ios-version.cjs --bump-build",
    ].join("\n")
  );
  process.exit(1);
};

const nextMarketingVersion = getArgValue("--version");
let nextBuildNumber = getArgValue("--build");
const bumpBuild = hasFlag("--bump-build");

if (!nextMarketingVersion && !nextBuildNumber && !bumpBuild) {
  printUsageAndExit();
}

if (nextBuildNumber && !/^\d+$/.test(nextBuildNumber)) {
  console.error("--build must be a positive integer.");
  process.exit(1);
}

let content = fs.readFileSync(projectFilePath, "utf8");

if (bumpBuild) {
  const match = content.match(/CURRENT_PROJECT_VERSION = (\d+);/);
  if (!match) {
    console.error("Could not find CURRENT_PROJECT_VERSION in project.pbxproj.");
    process.exit(1);
  }
  nextBuildNumber = String(Number(match[1]) + 1);
}

if (nextMarketingVersion) {
  const pattern = /MARKETING_VERSION = [^;]+;/g;
  if (!pattern.test(content)) {
    console.error("Could not find MARKETING_VERSION in project.pbxproj.");
    process.exit(1);
  }
  content = content.replace(
    pattern,
    `MARKETING_VERSION = ${nextMarketingVersion};`
  );
}

if (nextBuildNumber) {
  const pattern = /CURRENT_PROJECT_VERSION = [^;]+;/g;
  if (!pattern.test(content)) {
    console.error("Could not find CURRENT_PROJECT_VERSION in project.pbxproj.");
    process.exit(1);
  }
  content = content.replace(
    pattern,
    `CURRENT_PROJECT_VERSION = ${nextBuildNumber};`
  );
}

fs.writeFileSync(projectFilePath, content, "utf8");

const summary = [];
if (nextMarketingVersion) summary.push(`version=${nextMarketingVersion}`);
if (nextBuildNumber) summary.push(`build=${nextBuildNumber}`);
console.log(`Updated iOS ${summary.join(", ")} in ${projectFilePath}`);
