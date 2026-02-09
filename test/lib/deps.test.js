import { expect } from "chai";

import { formatDependencyStatus } from "../../dist/lib/deps.js";

describe("formatDependencyStatus", () => {
  it("returns 'detected' for detected status", () => {
    expect(formatDependencyStatus("detected")).to.equal("detected");
  });

  it("returns 'install instructions shown' for missing-install", () => {
    expect(formatDependencyStatus("missing-install")).to.equal(
      "install instructions shown",
    );
  });

  it("returns 'not detected' for missing-skipped", () => {
    expect(formatDependencyStatus("missing-skipped")).to.equal("not detected");
  });

  it("returns 'unknown' for unrecognized status", () => {
    expect(formatDependencyStatus("something-else")).to.equal("unknown");
  });
});
