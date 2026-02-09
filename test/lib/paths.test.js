import { expect } from "chai";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  defaultButanoDir,
  expandHome,
  hasUnsafePathCharacters,
  normalizeRelativePath,
  resolveButanoCommonDir,
  resolveButanoLibDir,
} from "../../dist/lib/paths.js";

describe("expandHome", () => {
  it("expands ~ to home directory", () => {
    const result = expandHome("~/Documents/butano");
    expect(result).to.equal(path.join(os.homedir(), "Documents", "butano"));
  });

  it("does not modify absolute paths", () => {
    expect(expandHome("/usr/local/bin")).to.equal("/usr/local/bin");
  });

  it("does not modify relative paths without ~", () => {
    expect(expandHome("some/path")).to.equal("some/path");
  });

  it("does not expand ~ in the middle of a path", () => {
    expect(expandHome("/home/~/path")).to.equal("/home/~/path");
  });

  it("handles ~/  at the start", () => {
    const result = expandHome("~/");
    expect(result).to.equal(path.join(os.homedir(), ""));
  });
});

describe("defaultButanoDir", () => {
  it("returns BUTANO_PATH env var when set", () => {
    const original = process.env.BUTANO_PATH;
    process.env.BUTANO_PATH = "/custom/butano";
    try {
      expect(defaultButanoDir()).to.equal("/custom/butano");
    } finally {
      if (original === undefined) {
        delete process.env.BUTANO_PATH;
      } else {
        process.env.BUTANO_PATH = original;
      }
    }
  });

  it("returns ~/Documents/butano when env var is not set", () => {
    const original = process.env.BUTANO_PATH;
    delete process.env.BUTANO_PATH;
    try {
      expect(defaultButanoDir()).to.equal(
        path.join(os.homedir(), "Documents", "butano"),
      );
    } finally {
      if (original !== undefined) {
        process.env.BUTANO_PATH = original;
      }
    }
  });
});

describe("hasUnsafePathCharacters", () => {
  it("returns false for safe paths", () => {
    expect(hasUnsafePathCharacters("/home/user/project")).to.equal(false);
    expect(hasUnsafePathCharacters("my-game")).to.equal(false);
    expect(hasUnsafePathCharacters("game_v1.0")).to.equal(false);
    expect(hasUnsafePathCharacters(String.raw`Users\game`)).to.equal(false);
  });

  it("returns true for paths with spaces", () => {
    expect(hasUnsafePathCharacters("/home/my game")).to.equal(true);
  });

  it("returns true for paths with special characters", () => {
    expect(hasUnsafePathCharacters("game@home")).to.equal(true);
    expect(hasUnsafePathCharacters("my$game")).to.equal(true);
    expect(hasUnsafePathCharacters("game!")).to.equal(true);
    expect(hasUnsafePathCharacters("game#1")).to.equal(true);
  });

  it("returns false for empty string", () => {
    expect(hasUnsafePathCharacters("")).to.equal(false);
  });
});

describe("normalizeRelativePath", () => {
  it("returns empty string for empty input", () => {
    expect(normalizeRelativePath("")).to.equal("");
  });

  it("returns empty string for dot", () => {
    expect(normalizeRelativePath(".")).to.equal("");
  });

  it("normalizes path separators to forward slashes", () => {
    // On all platforms, path.sep segments get joined with /
    const input = ["some", "path", "here"].join(path.sep);
    expect(normalizeRelativePath(input)).to.equal("some/path/here");
  });

  it("preserves forward slashes", () => {
    expect(normalizeRelativePath("some/path")).to.equal("some/path");
  });
});

describe("resolveButanoLibDir", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  it("returns butanoDir when butano.mak exists directly", async () => {
    await fs.writeFile(path.join(tmpDir, "butano.mak"), "");
    expect(resolveButanoLibDir(tmpDir)).to.equal(tmpDir);
  });

  it("returns nested butano dir when butano.mak exists there", async () => {
    const nestedDir = path.join(tmpDir, "butano");
    await fs.mkdir(nestedDir, { recursive: true });
    await fs.writeFile(path.join(nestedDir, "butano.mak"), "");
    expect(resolveButanoLibDir(tmpDir)).to.equal(nestedDir);
  });

  it("returns butanoDir as fallback when butano.mak is not found", async () => {
    expect(resolveButanoLibDir(tmpDir)).to.equal(tmpDir);
  });
});

describe("resolveButanoCommonDir", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  it("returns sibling common dir when it exists", async () => {
    const libDir = path.join(tmpDir, "butano");
    const commonDir = path.join(tmpDir, "common");
    await fs.mkdir(libDir, { recursive: true });
    await fs.mkdir(commonDir, { recursive: true });

    expect(resolveButanoCommonDir(libDir)).to.equal(commonDir);
  });

  it("returns nested common dir when sibling does not exist", async () => {
    const nestedCommon = path.join(tmpDir, "common");
    await fs.mkdir(nestedCommon, { recursive: true });

    expect(resolveButanoCommonDir(tmpDir)).to.equal(nestedCommon);
  });

  it("returns undefined when no common dir exists", async () => {
    expect(resolveButanoCommonDir(tmpDir)).to.equal(undefined);
  });
});
