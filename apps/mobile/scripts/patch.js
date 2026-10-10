const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const monorepoRoot = path.resolve(projectRoot, "../..");

const localTrackPlayer = path.resolve(
    projectRoot,
    "node_modules/react-native-track-player",
);
const rootTrackPlayer = path.resolve(
    monorepoRoot,
    "node_modules/react-native-track-player",
);
const patchesDir = path.resolve(projectRoot, "patches");

if (!fs.existsSync(patchesDir)) {
    process.exit(0);
}

try {
    if (fs.existsSync(localTrackPlayer)) {
        execSync("npx patch-package", {
            cwd: projectRoot,
            stdio: "inherit",
        });
    } else if (fs.existsSync(rootTrackPlayer)) {
        const relPatchDir = path.relative(monorepoRoot, patchesDir);
        execSync(`npx patch-package --patch-dir "${relPatchDir}"`, {
            cwd: monorepoRoot,
            stdio: "inherit",
        });
    }
} catch (error) {
    // Only fail if invoked explicitly, don't crash unrelated installs
    console.warn("[mobile:patch] Failed to apply patch:", error.message);
}
