import { existsSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const isWindows = platform() === "win32";

function javaExecutable(javaHome) {
  return join(javaHome, "bin", isWindows ? "java.exe" : "java");
}

function javaMajor(javaHome) {
  const executable = javaExecutable(javaHome);
  if (!existsSync(executable)) return null;

  const result = spawnSync(executable, ["-version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  const output = `${result.stderr || ""}\n${result.stdout || ""}`;
  const match = output.match(/version\s+"(\d+)/);
  return match ? Number(match[1]) : null;
}

function addChildren(candidates, directory) {
  if (!existsSync(directory)) return;
  try {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) candidates.push(join(directory, entry.name));
    }
  } catch {
    // Ignore inaccessible optional JDK locations.
  }
}

const candidates = [];
if (process.env.JAVA_HOME) candidates.push(process.env.JAVA_HOME);

if (isWindows) {
  addChildren(candidates, join(homedir(), "DevTools", "jdk-21"));
  addChildren(candidates, "C:\\Program Files\\Eclipse Adoptium");
  candidates.push("C:\\Program Files\\Android\\Android Studio\\jbr");
} else {
  addChildren(candidates, "/Library/Java/JavaVirtualMachines");
  addChildren(candidates, "/usr/lib/jvm");
}

const javaHome = candidates.find((candidate) => javaMajor(candidate) === 21);

if (!javaHome) {
  console.error(
    "AVENZO Android build requires JDK 21. Set JAVA_HOME to a JDK 21 installation and retry."
  );
  process.exit(1);
}

const env = {
  ...process.env,
  JAVA_HOME: javaHome,
  PATH: `${join(javaHome, "bin")}${isWindows ? ";" : ":"}${process.env.PATH || ""}`,
};

console.log(`Using JDK 21: ${javaHome}`);

const result = isWindows
  ? spawnSync(
      process.env.ComSpec || "cmd.exe",
      ["/d", "/s", "/c", "gradlew.bat assembleDebug --no-daemon"],
      {
        cwd: resolve("android"),
        env,
        stdio: "inherit",
        windowsHide: true,
      }
    )
  : spawnSync("./gradlew", ["assembleDebug", "--no-daemon"], {
      cwd: resolve("android"),
      env,
      stdio: "inherit",
    });

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  `APK ready: ${resolve("android", "app", "build", "outputs", "apk", "debug", "app-debug.apk")}`
);
