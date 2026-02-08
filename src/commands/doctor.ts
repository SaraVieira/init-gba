import { box, intro, spinner } from "@clack/prompts";
import { Command, Flags } from "@oclif/core";
import { gray, green, red, yellow } from "ansis";
import { existsSync } from "node:fs";
import path from "node:path";

import { commandExists, run } from "../lib/exec.js";
import { defaultButanoDir, expandHome } from "../lib/paths.js";

type CheckStatus = "error" | "ok" | "warn";

type CheckResult = {
  label: string;
  message: string;
  status: CheckStatus;
};

export default class Doctor extends Command {
  static description = "Check your environment for common Butano issues";

  static flags = {
    buildExample: Flags.boolean({
      aliases: ["build-example"],
      description: "Build a Butano example to validate the toolchain",
    }),
    butanoPath: Flags.string({
      aliases: ["butano-path"],
      description: "Butano installation path",
    }),
    examplePath: Flags.string({
      aliases: ["example-path"],
      description: "Example project path to build",
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Doctor);
    const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

    intro("Init GBA Doctor");

    const results: CheckResult[] = [];

    const devkitproEnv = process.env.DEVKITPRO;
    if (devkitproEnv && existsSync(devkitproEnv)) {
      results.push(this.result("DEVKITPRO", devkitproEnv, "ok"));
    } else {
      results.push(
        this.result(
          "DEVKITPRO",
          devkitproEnv ? "Path does not exist" : "Not set",
          "warn",
        ),
      );
    }

    const devkitarmEnv = process.env.DEVKITARM;
    const devkitarmFallback = devkitproEnv
      ? path.join(devkitproEnv, "devkitARM")
      : "";
    const devkitarmCandidates = [devkitarmEnv, devkitarmFallback].filter(
      (value): value is string => Boolean(value),
    );
    const devkitarmPath = devkitarmCandidates.find((candidate) =>
      existsSync(candidate),
    );
    if (devkitarmPath) {
      results.push(this.result("DEVKITARM", devkitarmPath, "ok"));
    } else {
      results.push(
        this.result(
          "DEVKITARM",
          "Not set or missing",
          "warn",
        ),
      );
    }

    const hasMake = await commandExists("make");
    results.push(
      this.result("make", hasMake ? "found" : "missing", hasMake ? "ok" : "error"),
    );

    const hasArmGcc = await commandExists("arm-none-eabi-gcc");
    results.push(
      this.result(
        "arm-none-eabi-gcc",
        hasArmGcc ? "found" : "missing",
        hasArmGcc ? "ok" : "error",
      ),
    );

    const hasPacman = await commandExists("dkp-pacman");
    results.push(
      this.result(
        "dkp-pacman",
        hasPacman ? "found" : "missing",
        hasPacman ? "ok" : "warn",
      ),
    );

    const butanoBase = expandHome(flags.butanoPath ?? defaultButanoDir());
    const butanoLibDir = resolveButanoLibDir(butanoBase);
    const butanoExists = existsSync(butanoBase);
    const butanoMakExists = existsSync(path.join(butanoLibDir, "butano.mak"));
    if (!butanoExists) {
      results.push(this.result("Butano", "Not found", "error"));
    } else if (!butanoMakExists) {
      results.push(this.result("Butano", "butano.mak missing", "warn"));
    } else {
      results.push(this.result("Butano", butanoLibDir, "ok"));
    }

    this.log("");
    for (const result of results) {
      this.logCheck(result, useColor);
    }

    if (flags.buildExample) {
      const examplePath = expandHome(
        flags.examplePath ?? defaultExamplePath(butanoBase),
      );
      await this.buildExample(examplePath, useColor);
    }

    this.log("");
    const summary = summarize(results);
    box(
      `OK: ${summary.ok}\nWarnings: ${summary.warn}\nErrors: ${summary.error}`,
      "Summary",
    );

    if (summary.error > 0) {
      this.log(this.colorize(yellow, "Fix the errors above and try again.", useColor));
    }
  }

  private async buildExample(examplePath: string, useColor: boolean): Promise<void> {
    if (!existsSync(examplePath)) {
      this.logCheck(
        this.result("Example build", "Example path not found", "warn"),
        useColor,
      );
      return;
    }

    const buildSpinner = spinner();
    buildSpinner.start("Building example");
    try {
      await run("make", ["-C", examplePath, "clean"]);
      await run("make", ["-C", examplePath]);
      buildSpinner.stop("Example build succeeded");
    } catch {
      buildSpinner.stop("Example build failed");
    }
  }

  private colorize(
    style: (value: string) => string,
    value: string,
    enabled: boolean,
  ): string {
    if (!enabled) return value;
    return style(value);
  }

  private result(label: string, message: string, status: CheckStatus): CheckResult {
    return { label, message, status };
  }

  private logCheck(result: CheckResult, useColor: boolean): void {
    const icon =
      result.status === "ok"
        ? this.colorize(green, "✔", useColor)
        : result.status === "warn"
          ? this.colorize(yellow, "!", useColor)
          : this.colorize(red, "✖", useColor);
    const detail = result.message
      ? this.colorize(gray, ` — ${result.message}`, useColor)
      : "";
    this.log(`${icon} ${result.label}${detail}`);
  }
}

function summarize(results: CheckResult[]): { error: number; ok: number; warn: number } {
  const summary = { error: 0, ok: 0, warn: 0 };
  for (const result of results) {
    summary[result.status] += 1;
  }
  return summary;
}

function defaultExamplePath(butanoBase: string): string {
  const candidates = [
    path.join(butanoBase, "examples", "text"),
    path.join(butanoBase, "examples", "core"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return path.join(butanoBase, "examples", "text");
}

function resolveButanoLibDir(butanoDir: string): string {
  const directPath = path.join(butanoDir, "butano.mak");
  if (existsSync(directPath)) {
    return butanoDir;
  }

  const nestedDir = path.join(butanoDir, "butano");
  const nestedPath = path.join(nestedDir, "butano.mak");
  if (existsSync(nestedPath)) {
    return nestedDir;
  }

  return butanoDir;
}
