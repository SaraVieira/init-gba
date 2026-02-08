import { Flags } from "@oclif/core";

import { resolveBundledExampleTemplate } from "./paths.js";

export const DEFAULT_BUTANO_REPO = "https://github.com/GValiente/butano.git";
export const DEFAULT_EXAMPLE_TEMPLATE = resolveBundledExampleTemplate();

export const FLAGS = {
  butanoPath: Flags.string({
    aliases: ["butano-path"],
    description: "Butano installation path",
  }),
  butanoRepo: Flags.string({
    aliases: ["butano-repo"],
    default: DEFAULT_BUTANO_REPO,
    description: "Butano git repository URL",
  }),
  dir: Flags.string({ description: "Target directory for the project" }),
  force: Flags.boolean({
    description: "Overwrite target directory if it exists",
  }),
  name: Flags.string({ char: "n", description: "Game name" }),
  nonInteractive: Flags.boolean({
    aliases: ["non-interactive"],
    description: "Fail if required input is missing",
  }),
  romCode: Flags.string({
    aliases: ["rom-code"],
    description: "ROM code (4 uppercase characters)",
  }),
  romTitle: Flags.string({
    aliases: ["rom-title"],
    description: "ROM title (uppercase, max 12 chars)",
  }),
  skipDeps: Flags.boolean({
    aliases: ["skip-deps"],
    description: "Skip devkitPro dependency checks",
  }),
  skipGit: Flags.boolean({
    aliases: ["skip-git"],
    description: "Skip git init",
  }),
  skipMakefile: Flags.boolean({
    aliases: ["skip-makefile"],
    description: "Skip Makefile generation",
  }),
  skipUpdate: Flags.boolean({
    aliases: ["skip-update"],
    description: "Skip checking for Butano updates",
  }),
  templatePath: Flags.string({
    aliases: ["template-path"],
    description: "Path to the template folder",
  }),
  templateToken: Flags.string({
    aliases: ["template-token"],
    description: "Template token to replace in files",
  }),
  yes: Flags.boolean({
    char: "y",
    description: "Accept defaults and skip prompts",
  }),
};
