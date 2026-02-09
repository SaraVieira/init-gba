import { expect } from "chai";

import { resolveRomMetadata } from "../../dist/lib/rom.js";

function makePrompts(responses = {}) {
  return {
    confirm: async (_msg, _def) =>
      responses.confirm === undefined ? false : responses.confirm,
    text: async (_msg, def) => responses.text === undefined ? def : responses.text,
  };
}

describe("resolveRomMetadata", () => {
  it("returns normalized flags when romTitle is provided", async () => {
    const result = await resolveRomMetadata({
      defaultCode: "GAME",
      defaultTitle: "DEFAULT",
      flags: { romTitle: "my-game" },
      nonInteractive: false,
      prompts: makePrompts(),
    });

    expect(result).to.deep.equal({
      code: "GAME",
      title: "MYGAME",
    });
  });

  it("returns normalized flags when romCode is provided", async () => {
    const result = await resolveRomMetadata({
      defaultCode: "GAME",
      defaultTitle: "DEFAULT",
      flags: { romCode: "ab" },
      nonInteractive: false,
      prompts: makePrompts(),
    });

    expect(result).to.deep.equal({
      code: "ABGG",
      title: "DEFAULT",
    });
  });

  it("returns normalized flags when both are provided", async () => {
    const result = await resolveRomMetadata({
      defaultCode: "GAME",
      defaultTitle: "DEFAULT",
      flags: { romCode: "test", romTitle: "cool game!" },
      nonInteractive: false,
      prompts: makePrompts(),
    });

    expect(result).to.deep.equal({
      code: "TEST",
      title: "COOL GAME",
    });
  });

  it("returns null in non-interactive mode without flags", async () => {
    const result = await resolveRomMetadata({
      defaultCode: "GAME",
      defaultTitle: "DEFAULT",
      flags: {},
      nonInteractive: true,
      prompts: makePrompts(),
    });

    expect(result).to.equal(null);
  });

  it("returns null when user declines to set metadata", async () => {
    const result = await resolveRomMetadata({
      defaultCode: "GAME",
      defaultTitle: "DEFAULT",
      flags: {},
      nonInteractive: false,
      prompts: makePrompts({ confirm: false }),
    });

    expect(result).to.equal(null);
  });

  it("prompts for title and code when user confirms", async () => {
    const prompts = {
      confirm: async () => true,
      text: async (_msg, def) => def,
    };

    const result = await resolveRomMetadata({
      defaultCode: "ABCD",
      defaultTitle: "MY TITLE",
      flags: {},
      nonInteractive: false,
      prompts,
    });

    expect(result).to.deep.equal({
      code: "ABCD",
      title: "MY TITLE",
    });
  });

  it("normalizes user-provided title and code from prompts", async () => {
    const prompts = {
      confirm: async () => true,
      async text(msg) {
        if (msg === "ROM title") return "cool game!";
        if (msg === "ROM code") return "xy";
        return "";
      },
    };

    const result = await resolveRomMetadata({
      defaultCode: "GAME",
      defaultTitle: "DEFAULT",
      flags: {},
      nonInteractive: false,
      prompts,
    });

    expect(result).to.deep.equal({
      code: "XYGG",
      title: "COOL GAME",
    });
  });
});
