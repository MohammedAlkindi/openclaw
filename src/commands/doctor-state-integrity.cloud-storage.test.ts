// Doctor state integrity cloud-storage tests cover macOS and Windows cloud-synced state directory detection.
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  detectMacCloudSyncedStateDir,
  detectWindowsCloudSyncedStateDir,
} from "./doctor-state-integrity.js";

describe("detectMacCloudSyncedStateDir", () => {
  const home = "/Users/tester";

  it("detects state dir under iCloud Drive", () => {
    const stateDir = path.join(
      home,
      "Library",
      "Mobile Documents",
      "com~apple~CloudDocs",
      "OpenClaw",
      ".openclaw",
    );

    const result = detectMacCloudSyncedStateDir(stateDir, {
      platform: "darwin",
      homedir: home,
    });

    expect(result).toEqual({
      path: path.resolve(stateDir),
      storage: "iCloud Drive",
    });
  });

  it("detects state dir under Library/CloudStorage", () => {
    const stateDir = path.join(home, "Library", "CloudStorage", "Dropbox", "OpenClaw", ".openclaw");

    const result = detectMacCloudSyncedStateDir(stateDir, {
      platform: "darwin",
      homedir: home,
    });

    expect(result).toEqual({
      path: path.resolve(stateDir),
      storage: "CloudStorage provider",
    });
  });

  it("detects cloud-synced target when state dir resolves via symlink", () => {
    const symlinkPath = "/tmp/openclaw-state";
    const resolvedCloudPath = path.join(
      home,
      "Library",
      "CloudStorage",
      "OneDrive-Personal",
      "OpenClaw",
      ".openclaw",
    );

    const result = detectMacCloudSyncedStateDir(symlinkPath, {
      platform: "darwin",
      homedir: home,
      resolveRealPath: () => resolvedCloudPath,
    });

    expect(result).toEqual({
      path: path.resolve(resolvedCloudPath),
      storage: "CloudStorage provider",
    });
  });

  it("ignores cloud-synced symlink prefix when resolved target is local", () => {
    const symlinkPath = path.join(
      home,
      "Library",
      "CloudStorage",
      "OneDrive-Personal",
      "OpenClaw",
      ".openclaw",
    );
    const resolvedLocalPath = path.join(home, ".openclaw");

    const result = detectMacCloudSyncedStateDir(symlinkPath, {
      platform: "darwin",
      homedir: home,
      resolveRealPath: () => resolvedLocalPath,
    });

    expect(result).toBeNull();
  });

  it("anchors cloud detection to OS homedir when OPENCLAW_HOME is overridden", () => {
    const stateDir = path.join(home, "Library", "CloudStorage", "iCloud Drive", ".openclaw");
    const originalOpenClawHome = process.env.OPENCLAW_HOME;
    process.env.OPENCLAW_HOME = "/tmp/openclaw-home-override";
    const homedirSpy = vi.spyOn(os, "homedir").mockReturnValue(home);
    try {
      const result = detectMacCloudSyncedStateDir(stateDir, {
        platform: "darwin",
      });

      expect(result).toEqual({
        path: path.resolve(stateDir),
        storage: "CloudStorage provider",
      });
    } finally {
      homedirSpy.mockRestore();
      if (originalOpenClawHome === undefined) {
        delete process.env.OPENCLAW_HOME;
      } else {
        process.env.OPENCLAW_HOME = originalOpenClawHome;
      }
    }
  });

  it("returns null outside darwin", () => {
    const stateDir = path.join(
      home,
      "Library",
      "Mobile Documents",
      "com~apple~CloudDocs",
      "OpenClaw",
      ".openclaw",
    );

    const result = detectMacCloudSyncedStateDir(stateDir, {
      platform: "linux",
      homedir: home,
    });

    expect(result).toBeNull();
  });
});

describe("detectWindowsCloudSyncedStateDir", () => {
  // Host-native absolute paths keep these assertions portable across POSIX
  // and Windows test hosts; the sync client's env vars are the detection
  // contract, not path shape.
  const home = path.resolve("/Users/tester");
  const oneDriveRoot = path.join(home, "OneDrive");
  const oneDriveBusinessRoot = path.join(home, "OneDrive - Contoso");

  it("detects state dir under the OneDrive sync root", () => {
    const stateDir = path.join(oneDriveRoot, "OpenClaw", ".openclaw");

    const result = detectWindowsCloudSyncedStateDir(stateDir, {
      platform: "win32",
      env: { OneDrive: oneDriveRoot },
    });

    expect(result).toEqual({
      path: path.resolve(stateDir),
      storage: "OneDrive",
    });
  });

  it("detects state dir under the OneDrive for Business sync root", () => {
    const stateDir = path.join(oneDriveBusinessRoot, "OpenClaw", ".openclaw");

    const result = detectWindowsCloudSyncedStateDir(stateDir, {
      platform: "win32",
      env: { OneDriveCommercial: oneDriveBusinessRoot },
    });

    expect(result).toEqual({
      path: path.resolve(stateDir),
      storage: "OneDrive for Business",
    });
  });

  it("matches sync roots case-insensitively", () => {
    const stateDir = path.join(oneDriveRoot, "OpenClaw", ".openclaw").toUpperCase();

    const result = detectWindowsCloudSyncedStateDir(stateDir, {
      platform: "win32",
      env: { OneDrive: oneDriveRoot.toLowerCase() },
    });

    expect(result).toEqual({
      path: path.resolve(stateDir),
      storage: "OneDrive",
    });
  });

  it("ignores cloud-synced junction prefix when resolved target is local", () => {
    const junctionPath = path.join(oneDriveRoot, "OpenClaw", ".openclaw");
    const resolvedLocalPath = path.join(home, ".openclaw");

    const result = detectWindowsCloudSyncedStateDir(junctionPath, {
      platform: "win32",
      env: { OneDrive: oneDriveRoot },
      resolveRealPath: () => resolvedLocalPath,
    });

    expect(result).toBeNull();
  });

  it("returns null when no OneDrive environment variables are set", () => {
    const stateDir = path.join(oneDriveRoot, "OpenClaw", ".openclaw");

    const result = detectWindowsCloudSyncedStateDir(stateDir, {
      platform: "win32",
      env: {},
    });

    expect(result).toBeNull();
  });

  it("returns null outside win32", () => {
    const stateDir = path.join(oneDriveRoot, "OpenClaw", ".openclaw");

    const result = detectWindowsCloudSyncedStateDir(stateDir, {
      platform: "linux",
      env: { OneDrive: oneDriveRoot },
    });

    expect(result).toBeNull();
  });
});
