const { execFileSync } = require("child_process");

const MIN_XCODE_MAJOR = 26;
const MIN_IOS_SDK_MAJOR = 26;

function run(command, args) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : "";
    throw new Error(`${command} ${args.join(" ")} failed. ${stderr}`.trim());
  }
}

function parseXcodeMajor(output) {
  const match = output.match(/^Xcode\s+(\d+)(?:\.(\d+))?/m);
  return match ? Number(match[1]) : null;
}

function parseSdkMajor(output) {
  const match = output.match(/^(\d+)(?:\.(\d+))?/);
  return match ? Number(match[1]) : null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const developerDir = run("xcode-select", ["-p"]);
const xcodeVersion = run("xcodebuild", ["-version"]);
const iosSdkVersion = run("xcrun", ["--sdk", "iphoneos", "--show-sdk-version"]);

const xcodeMajor = parseXcodeMajor(xcodeVersion);
const iosSdkMajor = parseSdkMajor(iosSdkVersion);

console.log(`Active developer directory: ${developerDir}`);
console.log(xcodeVersion);
console.log(`iPhoneOS SDK: ${iosSdkVersion}`);

if (!xcodeMajor) {
  fail("Could not determine the active Xcode version.");
}

if (!iosSdkMajor) {
  fail("Could not determine the active iPhoneOS SDK version.");
}

if (xcodeMajor < MIN_XCODE_MAJOR || iosSdkMajor < MIN_IOS_SDK_MAJOR) {
  fail(
    [
      "This Xcode toolchain is too old for App Store Connect upload.",
      `Required: Xcode ${MIN_XCODE_MAJOR}+ with iOS ${MIN_IOS_SDK_MAJOR}+ SDK.`,
      `Active: Xcode ${xcodeMajor}, iOS ${iosSdkVersion} SDK.`,
      "Install Xcode 26 or later, then switch to it with:",
      "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer",
      "If you keep multiple Xcodes installed, replace /Applications/Xcode.app with the Xcode 26 app path.",
    ].join("\n")
  );
}

console.log("iOS upload toolchain looks valid for App Store Connect.");
