import {
  box,
  cancel,
  intro,
  isCancel,
  select,
  spinner,
  text,
} from "@clack/prompts";
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
    buildExample: Flags.string({
      aliases: ["build-example"],
      description: "Build a preset example to validate the toolchain",
      options: ["core", "custom", "maxmod", "select", "text"],
    }),
    butanoPath: Flags.string({
      aliases: ["butano-path"],
      description: "Butano installation path",
    }),
    devkitpro: Flags.boolean({
      description: "Print devkitPro setup guidance",
    }),
    examplePath: Flags.string({
      aliases: ["example-path"],
      description: "Example project path to build (custom preset)",
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
      Boolean,
    ) as string[];
    const devkitarmPath = devkitarmCandidates.find((candidate) =>
      existsSync(candidate),
    );
    if (devkitarmPath) {
      results.push(this.result("DEVKITARM", devkitarmPath, "ok"));
    } else {
      results.push(this.result("DEVKITARM", "Not set or missing", "warn"));
    }

    const hasMake = await commandExists("make");
    results.push(
      this.result(
        "make",
        hasMake ? "found" : "missing",
        hasMake ? "ok" : "error",
      ),
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
    const butanoStatus = getButanoStatus(
      butanoExists,
      butanoMakExists,
      butanoLibDir,
    );
    results.push(
      this.result("Butano", butanoStatus.message, butanoStatus.status),
    );

    this.log("");
    for (const result of results) {
      this.logCheck(result, useColor);
    }

    if (isExamplePreset(flags.buildExample)) {
      const selection = await resolveExampleSelection({
        butanoBase,
        examplePath: flags.examplePath,
        preset: flags.buildExample,
      });
      if (selection) {
        await this.buildExample(selection, useColor);
      }
    }

    this.log("");
    if (flags.devkitpro) {
      box(
        [
          "devkitPro setup",
          "",
          "Install devkitPro pacman and set up your shell:",
          "https://devkitpro.org/wiki/devkitPro_pacman",
          "",
          "Required environment variables:",
          "DEVKITPRO=/path/to/devkitpro",
          "DEVKITARM=$DEVKITPRO/devkitARM",
          "",
          "Install the GBA toolchain:",
          "dkp-pacman -S gba-dev",
        ].join("\n"),
        "devkitPro",
      );
      this.log("");
    }

    const summary = summarize(results);
    box(
      `OK: ${summary.ok}\nWarnings: ${summary.warn}\nErrors: ${summary.error}`,
      "Summary",
    );

    if (summary.error > 0) {
      this.log(
        this.colorize(yellow, "Fix the errors above and try again.", useColor),
      );
    }
  }

  private async buildExample(
    selection: ExampleSelection,
    useColor: boolean,
  ): Promise<void> {
    if (!selection.path || !existsSync(selection.path)) {
      this.logCheck(
        this.result("Example build", `${selection.label} not found`, "warn"),
        useColor,
      );
      return;
    }

    const buildSpinner = spinner();
    buildSpinner.start(`Building ${selection.label}`);
    try {
      await run("make", ["-C", selection.path, "clean"]);
      await run("make", ["-C", selection.path]);
      buildSpinner.stop(`Example build succeeded (${selection.label})`);
    } catch {
      buildSpinner.stop(`Example build failed (${selection.label})`);
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

  private result(
    label: string,
    message: string,
    status: CheckStatus,
  ): CheckResult {
    return { label, message, status };
  }
}

function summarize(results: CheckResult[]): {
  error: number;
  ok: number;
  warn: number;
} {
  const summary = { error: 0, ok: 0, warn: 0 };
  for (const result of results) {
    summary[result.status] += 1;
  }

  return summary;
}

function getButanoStatus(
  exists: boolean,
  makExists: boolean,
  libDir: string,
): { message: string; status: CheckStatus } {
  if (exists) {
    if (makExists) {
      return { message: libDir, status: "ok" };
    }

    return { message: "butano.mak missing", status: "warn" };
  }

  return { message: "Not found", status: "error" };
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

type ExamplePreset = "core" | "custom" | "maxmod" | "select" | "text";

type ExampleSelection = {
  label: string;
  path: string;
};

type ExampleSelectionInput = {
  butanoBase: string;
  examplePath?: string;
  preset: ExamplePreset;
};

async function resolveExampleSelection(
  input: ExampleSelectionInput,
): Promise<ExampleSelection | null> {
  const { butanoBase, examplePath, preset } = input;

  if (preset === "select") {
    if (!process.stdin.isTTY) {
      return {
        label: "Butano text example",
        path: path.join(butanoBase, "examples", "text"),
      };
    }

    const choice = await select({
      message: "Select an example to build",
      options: [
        { label: "Maxmod (devkitPro example)", value: "maxmod" },
        { label: "Butano text example", value: "text" },
        { label: "Butano core example", value: "core" },
        { label: "Custom path", value: "custom" },
      ],
    });
    if (isCancel(choice)) {
      cancel("Operation cancelled.");
      return null;
    }

    return resolveExampleSelection({
      butanoBase,
      examplePath,
      preset: choice as ExamplePreset,
    });
  }

  if (preset === "custom") {
    const resolvedCustomPath = await resolveCustomExamplePath(examplePath);
    if (!resolvedCustomPath) {
      return null;
    }

    return { label: "Custom example", path: resolvedCustomPath };
  }

  if (preset === "core") {
    return {
      label: "Butano core example",
      path: path.join(butanoBase, "examples", "core"),
    };
  }

  if (preset === "text") {
    return {
      label: "Butano text example",
      path: path.join(butanoBase, "examples", "text"),
    };
  }

  const devkitproEnv = process.env.DEVKITPRO;
  if (!devkitproEnv) {
    return {
      label: "Maxmod example (DEVKITPRO not set)",
      path: "",
    };
  }

  const maxmodPath = resolveMaxmodExamplePath(devkitproEnv);
  if (!maxmodPath) {
    return {
      label: "Maxmod example (not found)",
      path: "",
    };
  }

  return {
    label: "Maxmod example",
    path: maxmodPath,
  };
}

async function resolveCustomExamplePath(
  examplePath?: string,
): Promise<null | string> {
  if (examplePath && examplePath.trim()) {
    return expandHome(examplePath.trim());
  }

  if (!process.stdin.isTTY) {
    return null;
  }

  const value = await text({
    message: "Custom example path",
    placeholder: "/path/to/example",
    validate(inputValue) {
      if (!inputValue || inputValue.trim().length === 0) {
        return "Path is required";
      }
    },
  });
  if (isCancel(value)) {
    cancel("Operation cancelled.");
    return null;
  }

  if (typeof value !== "string") return null;
  return expandHome(value.trim());
}

function resolveMaxmodExamplePath(devkitproDir: string): null | string {
  const candidates = [
    path.join(devkitproDir, "examples", "gba", "maxmod"),
    path.join(devkitproDir, "examples", "gba", "audio", "maxmod"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

function isExamplePreset(value?: string): value is ExamplePreset {
  return (
    value === "core" ||
    value === "custom" ||
    value === "maxmod" ||
    value === "select" ||
    value === "text"
  );
}
