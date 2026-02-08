import { runCommand } from "@oclif/test";
import { expect } from "chai";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

describe("create", () => {
  it("creates a project from the template", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-"));
    const targetDir = path.join(tmpDir, "MyGame");
    const fixtureRoot = path.resolve("test/fixtures/butano");
    const templatePath = path.join(fixtureRoot, "template");

    const { stdout } = await runCommand([
      "create",
      "--name",
      "MyGame",
      "--dir",
      targetDir,
      "--butano-path",
      fixtureRoot,
      "--template-path",
      templatePath,
      "--skip-deps",
      "--skip-update",
      "--skip-git",
      "--non-interactive",
    ]);

    expect(stdout).to.contain("Done!");
    expect(await pathExists(path.join(targetDir, "CMakeLists.txt"))).to.equal(
      true,
    );
    expect(await pathExists(path.join(targetDir, "Makefile"))).to.equal(true);

    const cmake = await fs.readFile(
      path.join(targetDir, "CMakeLists.txt"),
      "utf8",
    );
    expect(cmake).to.contain("project(MyGame)");

    const renamed = await pathExists(
      path.join(targetDir, "src", "MyGame_main.cpp"),
    );
    expect(renamed).to.equal(true);
  });
});
