import { expect } from "chai";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  copyTemplate,
  makefileContents,
  overlayTemplate,
  removeGitDir,
  renamePathsWithToken,
  replaceTokenInTextFiles,
  toRomCode,
  toRomTitle,
} from "../../dist/lib/template.js";

describe("toRomTitle", () => {
  it("uppercases and strips non-alphanumeric characters", () => {
    expect(toRomTitle("my-game")).to.equal("MYGAME");
  });

  it("truncates to 12 characters", () => {
    expect(toRomTitle("abcdefghijklmnop")).to.equal("ABCDEFGHIJKL");
  });

  it("returns GBA for empty string", () => {
    expect(toRomTitle("")).to.equal("GBA");
  });

  it("returns GBA when all characters are stripped", () => {
    expect(toRomTitle("---")).to.equal("GBA");
  });

  it("keeps alphanumeric characters", () => {
    expect(toRomTitle("Game123")).to.equal("GAME123");
  });

  it("handles single character", () => {
    expect(toRomTitle("x")).to.equal("X");
  });

  it("handles exactly 12 character input", () => {
    expect(toRomTitle("abcdefghijkl")).to.equal("ABCDEFGHIJKL");
  });
});

describe("toRomCode", () => {
  it("uppercases and strips non-alphanumeric characters", () => {
    expect(toRomCode("my-game")).to.equal("MYGA");
  });

  it("truncates to 4 characters", () => {
    expect(toRomCode("abcdefgh")).to.equal("ABCD");
  });

  it("pads short input with G", () => {
    expect(toRomCode("ab")).to.equal("ABGG");
  });

  it("returns GAME for empty string", () => {
    expect(toRomCode("")).to.equal("GAME");
  });

  it("returns GAME when all characters are stripped", () => {
    expect(toRomCode("---")).to.equal("GAME");
  });

  it("handles single character input", () => {
    expect(toRomCode("x")).to.equal("XGGG");
  });

  it("handles exactly 4 character input", () => {
    expect(toRomCode("test")).to.equal("TEST");
  });
});

describe("makefileContents", () => {
  it("includes the butano path", () => {
    const result = makefileContents("/home/user/butano", "mygame");
    expect(result).to.contain("LIBBUTANO     :=  /home/user/butano");
  });

  it("uses toRomTitle and toRomCode defaults from projectId", () => {
    const result = makefileContents("/butano", "cool-game");
    expect(result).to.contain("ROMTITLE      :=  COOLGAME");
    expect(result).to.contain("ROMCODE       :=  COOL");
  });

  it("uses provided romMetadata when given", () => {
    const result = makefileContents("/butano", "mygame", undefined, {
      code: "ABCD",
      title: "MY GAME",
    });
    expect(result).to.contain("ROMTITLE      :=  MY GAME");
    expect(result).to.contain("ROMCODE       :=  ABCD");
  });

  it("escapes spaces in butano path", () => {
    const result = makefileContents("/home/my user/butano", "game");
    expect(result).to.contain(String.raw`LIBBUTANO     :=  /home/my\ user/butano`);
  });

  it("includes common dir paths when provided", () => {
    const result = makefileContents("/butano", "game", "/common");
    expect(result).to.contain("include /common/include");
    expect(result).to.contain("graphics /common/graphics");
    expect(result).to.contain("audio /common/audio");
    expect(result).to.contain("dmg_audio /common/dmg_audio");
  });

  it("uses simple paths when no common dir", () => {
    const result = makefileContents("/butano", "game");
    expect(result).to.contain("INCLUDES      :=  include");
    expect(result).to.contain("GRAPHICS      :=  graphics");
    expect(result).to.contain("AUDIO         :=  audio");
    expect(result).to.contain("DMGAUDIO      :=  dmg_audio");
  });

  it("includes the butano.mak include", () => {
    const result = makefileContents("/butano", "game");
    expect(result).to.contain("include $(LIBBUTANOABS)/butano.mak");
  });
});

describe("copyTemplate", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  it("copies files from source to destination", async () => {
    const srcDir = path.join(tmpDir, "src");
    const destDir = path.join(tmpDir, "dest");
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, "hello.txt"), "world");

    await copyTemplate(srcDir, destDir);

    const content = await fs.readFile(path.join(destDir, "hello.txt"), "utf8");
    expect(content).to.equal("world");
  });

  it("copies nested directories", async () => {
    const srcDir = path.join(tmpDir, "src");
    const destDir = path.join(tmpDir, "dest");
    await fs.mkdir(path.join(srcDir, "sub"), { recursive: true });
    await fs.writeFile(path.join(srcDir, "sub", "nested.txt"), "data");

    await copyTemplate(srcDir, destDir);

    const content = await fs.readFile(
      path.join(destDir, "sub", "nested.txt"),
      "utf8",
    );
    expect(content).to.equal("data");
  });
});

describe("overlayTemplate", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  it("copies files into an existing directory", async () => {
    const srcDir = path.join(tmpDir, "src");
    const destDir = path.join(tmpDir, "dest");
    await fs.mkdir(srcDir, { recursive: true });
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, "existing.txt"), "keep");
    await fs.writeFile(path.join(srcDir, "new.txt"), "added");

    await overlayTemplate(srcDir, destDir);

    expect(
      await fs.readFile(path.join(destDir, "existing.txt"), "utf8"),
    ).to.equal("keep");
    expect(await fs.readFile(path.join(destDir, "new.txt"), "utf8")).to.equal(
      "added",
    );
  });
});

describe("removeGitDir", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  it("removes .git directory if present", async () => {
    const gitDir = path.join(tmpDir, ".git");
    await fs.mkdir(gitDir);
    await fs.writeFile(path.join(gitDir, "HEAD"), "ref: refs/heads/main");

    await removeGitDir(tmpDir);

    let exists = true;
    try {
      await fs.access(gitDir);
    } catch {
      exists = false;
    }

    expect(exists).to.equal(false);
  });

  it("does not throw if .git does not exist", async () => {
    await removeGitDir(tmpDir);
    // should not throw
  });
});

describe("replaceTokenInTextFiles", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  it("replaces token in text files", async () => {
    await fs.writeFile(
      path.join(tmpDir, "file.cpp"),
      "hello template world",
    );

    const count = await replaceTokenInTextFiles(tmpDir, "template", "mygame");
    expect(count).to.equal(1);

    const content = await fs.readFile(path.join(tmpDir, "file.cpp"), "utf8");
    expect(content).to.equal("hello mygame world");
  });

  it("replaces uppercase and lowercase variants", async () => {
    await fs.writeFile(
      path.join(tmpDir, "file.h"),
      "TOKEN token Token",
    );

    const count = await replaceTokenInTextFiles(tmpDir, "Token", "Game");
    expect(count).to.equal(1);

    const content = await fs.readFile(path.join(tmpDir, "file.h"), "utf8");
    expect(content).to.contain("GAME");
    expect(content).to.contain("game");
  });

  it("skips binary files", async () => {
    const buf = Buffer.from([0x00, 0x01, 0x02]);
    await fs.writeFile(path.join(tmpDir, "binary.bin"), buf);

    const count = await replaceTokenInTextFiles(tmpDir, "template", "game");
    expect(count).to.equal(0);
  });

  it("skips non-text extensions", async () => {
    await fs.writeFile(path.join(tmpDir, "image.png"), "template");

    const count = await replaceTokenInTextFiles(tmpDir, "template", "game");
    expect(count).to.equal(0);
  });

  it("returns 0 when no replacements are made", async () => {
    await fs.writeFile(path.join(tmpDir, "file.txt"), "nothing to replace");

    const count = await replaceTokenInTextFiles(tmpDir, "template", "game");
    expect(count).to.equal(0);
  });

  it("handles nested directories", async () => {
    await fs.mkdir(path.join(tmpDir, "sub"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "sub", "file.c"),
      "template code",
    );

    const count = await replaceTokenInTextFiles(tmpDir, "template", "mygame");
    expect(count).to.equal(1);

    const content = await fs.readFile(
      path.join(tmpDir, "sub", "file.c"),
      "utf8",
    );
    expect(content).to.equal("mygame code");
  });
});

describe("renamePathsWithToken", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "init-gba-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { force: true, recursive: true });
  });

  it("renames files containing the token", async () => {
    await fs.writeFile(path.join(tmpDir, "template_main.cpp"), "code");

    const count = await renamePathsWithToken(tmpDir, "template", "mygame");
    expect(count).to.equal(1);

    const exists = await fs
      .access(path.join(tmpDir, "mygame_main.cpp"))
      .then(() => true)
      .catch(() => false);
    expect(exists).to.equal(true);
  });

  it("renames directories containing the token", async () => {
    await fs.mkdir(path.join(tmpDir, "template_dir"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "template_dir", "file.txt"),
      "data",
    );

    const count = await renamePathsWithToken(tmpDir, "template", "mygame");
    expect(count).to.be.at.least(1);

    const exists = await fs
      .access(path.join(tmpDir, "mygame_dir"))
      .then(() => true)
      .catch(() => false);
    expect(exists).to.equal(true);
  });

  it("returns 0 when no paths match", async () => {
    await fs.writeFile(path.join(tmpDir, "main.cpp"), "code");

    const count = await renamePathsWithToken(tmpDir, "template", "mygame");
    expect(count).to.equal(0);
  });

  it("returns 0 for empty token", async () => {
    await fs.writeFile(path.join(tmpDir, "file.txt"), "data");

    const count = await renamePathsWithToken(tmpDir, "", "mygame");
    expect(count).to.equal(0);
  });
});
