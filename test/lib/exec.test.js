import { expect } from "chai";

import { commandExists, run } from "../../dist/lib/exec.js";

describe("run", () => {
  it("returns stdout from a command", async () => {
    const { stdout } = await run("echo", ["hello"]);
    expect(stdout.trim()).to.equal("hello");
  });

  it("returns stderr from a command", async () => {
    const { stderr } = await run("echo", ["hello"]);
    expect(stderr).to.be.a("string");
  });

  it("rejects for a non-existent command", async () => {
    try {
      await run("nonexistent-command-xyz", []);
      expect.fail("should have thrown");
    } catch (error) {
      expect(error).to.be.an("error");
    }
  });

  it("accepts cwd option", async () => {
    const { stdout } = await run("pwd", [], { cwd: "/tmp" });
    expect(stdout.trim()).to.match(/tmp/);
  });
});

describe("commandExists", () => {
  it("returns true for a command that exists", async () => {
    const result = await commandExists("echo");
    expect(result).to.equal(true);
  });

  it("returns false for a command that does not exist", async () => {
    const result = await commandExists("nonexistent-command-xyz-12345");
    expect(result).to.equal(false);
  });
});
