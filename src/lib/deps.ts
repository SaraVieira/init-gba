import { Command } from "@oclif/core";
import { existsSync } from "node:fs";

import { commandExists } from "./exec.js";
import { PromptSession } from "./prompt.js";
import { DependencyStatus } from "./types.js";

export async function handleDependencies(
  prompts: PromptSession,
  command: Command,
): Promise<DependencyStatus> {
  const hasDevkit = await detectDevkitPro();
  if (hasDevkit) return "detected";

  const install = await prompts.confirm(
    "devkitPro was not detected. Install it now?",
    false,
  );
  if (!install) return "missing-skipped";

  command.log("Automatic devkitPro installation is not implemented yet.");
  command.log(
    "Please follow the official instructions: https://devkitpro.org/wiki/Getting_Started",
  );
  return "missing-install";
}

async function detectDevkitPro(): Promise<boolean> {
  const envPath = process.env.DEVKITPRO;
  if (envPath && existsSync(envPath)) return true;

  if (await commandExists("arm-none-eabi-gcc")) return true;
  if (await commandExists("devkitpro-pacman")) return true;

  return false;
}

export function formatDependencyStatus(status: DependencyStatus): string {
  switch (status) {
    case "detected": {
      return "detected";
    }

    case "missing-install": {
      return "install instructions shown";
    }

    case "missing-skipped": {
      return "not detected";
    }

    default: {
      return "unknown";
    }
  }
}
