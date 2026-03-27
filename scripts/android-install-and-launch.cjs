const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const androidDir = path.join(repoRoot, "android");
const apkPath = path.join(
  androidDir,
  "app",
  "build",
  "outputs",
  "apk",
  "debug",
  "app-debug.apk"
);
const publicIndexPath = path.join(
  androidDir,
  "app",
  "src",
  "main",
  "assets",
  "public",
  "index.html"
);
const appId = "org.cardanofoundation.idw";
const appActivity = `${appId}/.MainActivity`;
const isWindows = process.platform === "win32";

function resolveJavaHome() {
  if (process.env.JAVA_HOME) {
    return process.env.JAVA_HOME;
  }

  const defaultJavaHome = path.join(
    "C:",
    "Program Files",
    "Android",
    "Android Studio",
    "jbr"
  );

  return fs.existsSync(defaultJavaHome) ? defaultJavaHome : "";
}

function resolveAdb() {
  const candidates = [
    process.env.ADB_PATH,
    process.env.LOCALAPPDATA
      ? path.join(
          process.env.LOCALAPPDATA,
          "Android",
          "Sdk",
          "platform-tools",
          isWindows ? "adb.exe" : "adb"
        )
      : "",
    process.env.ANDROID_HOME
      ? path.join(
          process.env.ANDROID_HOME,
          "platform-tools",
          isWindows ? "adb.exe" : "adb"
        )
      : "",
    process.env.ANDROID_SDK_ROOT
      ? path.join(
          process.env.ANDROID_SDK_ROOT,
          "platform-tools",
          isWindows ? "adb.exe" : "adb"
        )
      : "",
    isWindows ? "adb.exe" : "adb",
  ].filter(Boolean);

  const adbPath = candidates.find((candidate) => {
    if (candidate === "adb.exe" || candidate === "adb") {
      return true;
    }

    return fs.existsSync(candidate);
  });

  if (!adbPath) {
    throw new Error("Unable to locate adb. Set ADB_PATH or install Android SDK platform-tools.");
  }

  return adbPath;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    stdio: "inherit",
    shell: options.shell ?? isWindows,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `Command failed (${result.status}): ${command} ${args.join(" ")}`
    );
  }
}

function main() {
  if (!fs.existsSync(publicIndexPath)) {
    throw new Error(
      `Android web assets are missing. Run "npm run build:cap" first. Missing: ${publicIndexPath}`
    );
  }

  const javaHome = resolveJavaHome();
  const adbPath = resolveAdb();
  const env = { ...process.env };

  if (javaHome) {
    env.JAVA_HOME = javaHome;
    env.PATH = `${path.join(javaHome, "bin")}${path.delimiter}${env.PATH || ""}`;
  }

  run(adbPath, ["devices"], { env });

  if (process.argv.includes("--fresh")) {
    run(adbPath, ["uninstall", appId], {
      env,
      allowFailure: true,
    });
  }

  run(path.join(androidDir, isWindows ? "gradlew.bat" : "gradlew"), ["assembleDebug"], {
    cwd: androidDir,
    env,
  });

  if (!fs.existsSync(apkPath)) {
    throw new Error(`Debug APK not found after assembleDebug: ${apkPath}`);
  }

  run(adbPath, ["install", "-r", apkPath], { env });
  run(adbPath, ["shell", "am", "start", "-n", appActivity], { env });
}

main();
