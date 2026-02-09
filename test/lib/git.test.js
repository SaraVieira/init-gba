import { expect } from "chai";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { isGitRepo } from "../../dist/lib/git.js";

describe("isGitRepo", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  it("returns true when .git directory exists", async () => {
    await fs.mkdir(path.join(tmpDir, ".git"));
    const result = await isGitRepo(tmpDir);
    expect(result).to.equal(true);
  });

  it("returns false when .git directory does not exist", async () => {
    const result = await isGitRepo(tmpDir);
    expect(result).to.equal(false);
  });
});
