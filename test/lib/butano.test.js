import { expect } from "chai";

import { formatButanoStatus } from "../../dist/lib/butano.js";

describe("formatButanoStatus", () => {
  it("returns 'downloaded' for downloaded status", () => {
    expect(formatButanoStatus("downloaded")).to.equal("downloaded");
  });

  it("returns 'ready' for existing status", () => {
    expect(formatButanoStatus("existing")).to.equal("ready");
  });

  it("returns 'version unknown' for unknown status", () => {
    expect(formatButanoStatus("unknown")).to.equal("version unknown");
  });

  it("returns 'up to date' for up-to-date status", () => {
    expect(formatButanoStatus("up-to-date")).to.equal("up to date");
  });

  it("returns 'updated' for updated status", () => {
    expect(formatButanoStatus("updated")).to.equal("updated");
  });

  it("returns 'ready' for unrecognized status", () => {
    expect(formatButanoStatus("something-else")).to.equal("ready");
  });
});
