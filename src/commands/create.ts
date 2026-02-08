import { box, intro, note, spinner } from "@clack/prompts";
import { Command, Flags } from "@oclif/core";
import { gray, green, yellow } from "ansis";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { commandExists, run } from "../lib/exec.js";
import {
  cloneRepo,
  getLocalHead,
  getRemoteHead,
  isGitRepo,
  updateRepo,
} from "../lib/git.js";
import { defaultButanoDir, expandHome } from "../lib/paths.js";
import { PromptSession } from "../lib/prompt.js";
import {
  copyTemplate,
  makefileContents,
  overlayTemplate,
  removeGitDir,
  renamePathsWithToken,
  replaceTokenInTextFiles,
  type RomMetadata,
  toRomCode,
  toRomTitle,
} from "../lib/template.js";

const DEFAULT_BUTANO_REPO = "https://github.com/GValiente/butano.git";
const DEFAULT_EXAMPLE_TEMPLATE = resolveBundledExampleTemplate();

export default class Create extends Command {
  static description = "Create a new GBA project using Butano";
  static flags = {
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

  async run(): Promise<void> {
    const { flags } = await this.parse(Create);

    const interactive = process.stdin.isTTY;
    const nonInteractive = flags.nonInteractive || flags.yes || !interactive;
    const prompts = new PromptSession({ nonInteractive });
    const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

    try {
      intro(`
        ▗▄▄▖ ■  ▗▞▀▜▌ ▄▄▄ ■      ▗▞▀▜▌     ▗▄▄▖▗▄▄▖  ▗▄▖      ▗▄▄▖▗▞▀▜▌▄▄▄▄  ▗▞▀▚▖
       ▐▌ ▗▄▟▙▄▖▝▚▄▟▌█ ▗▄▟▙▄▖    ▝▚▄▟▌    ▐▌   ▐▌ ▐▌▐▌ ▐▌    ▐▌   ▝▚▄▟▌█ █ █ ▐▛▀▀▘
        ▝▀▚▖▐▌       █   ▐▌               ▐▌▝▜▌▐▛▀▚▖▐▛▀▜▌    ▐▌▝▜▌     █   █ ▝▚▄▄▖
       ▗▄▄▞▘▐▌           ▐▌               ▝▚▄▞▘▐▙▄▞▘▐▌ ▐▌    ▝▚▄▞▘
            ▐▌           ▐▌
        `);
      const defaultName = path.basename(process.cwd()) || "my-gba-game";
      const projectName = await resolveText(
        flags.name,
        prompts,
        "Name",
        defaultName,
      );
      const projectId = toProjectId(projectName);

      const defaultDir = path.resolve(process.cwd(), projectName);
      const targetDir = expandHome(
        await resolveText(flags.dir, prompts, "Project directory", defaultDir),
      );

      if (hasUnsafePathCharacters(targetDir)) {
        const warningMessage =
          "Project path contains spaces or special characters.\nButano recommends avoiding them.";
        if (process.stdout.isTTY) {
          note(warningMessage, "Path warning");
        } else {
          this.log(
            `${this.colorize(yellow, "!", useColor)} ${warningMessage.replaceAll("\n", " ")}`,
          );
        }
      }

      await ensureEmptyTarget(targetDir, flags.force, prompts);
      this.logProgress("Project", projectName, "success", useColor);

      const defaultButano = expandHome(defaultButanoDir());
      const butanoDir = expandHome(
        await resolveText(
          flags.butanoPath,
          prompts,
          "Butano path",
          defaultButano,
        ),
      );

      const butanoStatus = await ensureButano(butanoDir, flags, prompts, this);
      this.logProgress(
        "Butano",
        formatButanoStatus(butanoStatus),
        "success",
        useColor,
      );

      if (!flags.skipDeps) {
        const dependencyStatus = await handleDependencies(prompts, this);
        this.logProgress(
          "devkitPro",
          formatDependencyStatus(dependencyStatus),
          dependencyStatus === "detected" ? "success" : "skip",
          useColor,
        );
      }

      const templatePath = expandHome(
        flags.templatePath ?? path.join(butanoDir, "template"),
      );

      if (!existsSync(templatePath)) {
        throw new Error(`Template path does not exist: ${templatePath}`);
      }

      const templateToken = flags.templateToken ?? "template";

      await fs.mkdir(targetDir, { recursive: true });
      await copyTemplate(templatePath, targetDir);
      await maybeOverlayExampleTemplate(targetDir);
      await removeGitDir(targetDir);
      this.logProgress("Template", "copied", "success", useColor);

      await renamePathsWithToken(targetDir, templateToken, projectName);
      const changedFiles = await replaceTokenInTextFiles(
        targetDir,
        templateToken,
        projectName,
      );

      if (!flags.skipMakefile) {
        const libButanoDir = resolveButanoLibDir(butanoDir);
        const commonDir = resolveButanoCommonDir(libButanoDir);
        const commonDirRelative = commonDir
          ? normalizeRelativePath(path.relative(targetDir, commonDir))
          : undefined;
        const romMetadata = await resolveRomMetadata({
          defaultCode: toRomCode(projectId),
          defaultTitle: toRomTitle(projectId),
          flags,
          nonInteractive,
          prompts,
        });
        await maybeCreateMakefile({
          butanoDir: libButanoDir,
          commonDir: commonDirRelative,
          projectId,
          romMetadata: romMetadata ?? undefined,
          targetDir,
        });
        this.logProgress("Makefile", "written", "success", useColor);
      }

      if (!flags.skipGit) {
        const gitInitialized = await maybeInitGit(targetDir, prompts, this);
        this.logProgress(
          "Git",
          gitInitialized ? "initialized" : "skipped",
          gitInitialized ? "success" : "skip",
          useColor,
        );
      }

      this.log(`${this.colorize(green, "✔", useColor)} Done!`);
      this.log(`Project created at: ${targetDir}`);

      if (changedFiles > 0) {
        this.log(`Updated files: ${changedFiles}`);
      }

      this.log("");
      box(
        `Project: ${targetDir}\n\nNext steps:\ncd ${targetDir}\nmake`,
        "Summary",
      );
    } finally {
      prompts.close();
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

  private logProgress(
    label: string,
    detail: string,
    status: "error" | "skip" | "success",
    useColor: boolean,
  ): void {
    const icon =
      status === "success"
        ? this.colorize(green, "✔", useColor)
        : status === "skip"
          ? this.colorize(gray, "•", useColor)
          : this.colorize(yellow, "!", useColor);
    const detailText = detail
      ? this.colorize(gray, ` — ${detail}`, useColor)
      : "";
    this.log(`${icon} ${label}${detailText}`);
  }
}

async function resolveText(
  value: string | undefined,
  prompts: PromptSession,
  message: string,
  defaultValue?: string,
): Promise<string> {
  if (value && value.trim().length > 0) return value.trim();
  return prompts.text(message, defaultValue);
}

async function ensureEmptyTarget(
  targetDir: string,
  force: boolean | undefined,
  prompts: PromptSession,
): Promise<void> {
  if (!existsSync(targetDir)) return;

  const entries = await fs.readdir(targetDir);
  if (entries.length === 0) return;

  if (force) {
    await fs.rm(targetDir, { force: true, recursive: true });
    return;
  }

  const overwrite = await prompts.confirm(
    `Target directory is not empty. Overwrite ${targetDir}?`,
    false,
  );
  if (!overwrite) {
    throw new Error("Aborted: target directory is not empty.");
  }

  await fs.rm(targetDir, { force: true, recursive: true });
}

type EnsureButanoFlags = {
  butanoRepo?: string;
  skipUpdate?: boolean;
};

type ButanoStatus =
  | "downloaded"
  | "existing"
  | "unknown"
  | "up-to-date"
  | "updated";

async function ensureButano(
  butanoDir: string,
  flags: EnsureButanoFlags,
  prompts: PromptSession,
  command: Command,
): Promise<ButanoStatus> {
  const repoUrl = flags.butanoRepo || DEFAULT_BUTANO_REPO;

  if (!existsSync(butanoDir)) {
    const download = await prompts.confirm(
      `Butano not found at ${butanoDir}. Download now?`,
      true,
    );
    if (!download) {
      throw new Error("Butano is required to continue.");
    }

    await ensureGitAvailable();
    await fs.mkdir(path.dirname(butanoDir), { recursive: true });
    const downloadSpinner = spinner();
    downloadSpinner.start("Downloading Butano");
    await cloneRepo(repoUrl, butanoDir);
    downloadSpinner.stop("Butano downloaded");
    return "downloaded";
  }

  if (!(await isGitRepo(butanoDir))) {
    const redownload = await prompts.confirm(
      "Butano folder is not a git repo. Re-download it?",
      false,
    );
    if (!redownload) return "existing";

    await ensureGitAvailable();
    await fs.rm(butanoDir, { force: true, recursive: true });
    await fs.mkdir(path.dirname(butanoDir), { recursive: true });
    const downloadSpinner = spinner();
    downloadSpinner.start("Downloading Butano");
    await cloneRepo(repoUrl, butanoDir);
    downloadSpinner.stop("Butano downloaded");
    return "downloaded";
  }

  if (flags.skipUpdate) return "existing";

  const checkUpdates = await prompts.confirm("Check Butano for updates?", true);
  if (!checkUpdates) return "existing";

  await ensureGitAvailable();
  const local = await getLocalHead(butanoDir);
  const remote = await getRemoteHead(butanoDir);

  if (!local || !remote) {
    command.log("Could not determine Butano version. Skipping update.");
    return "unknown";
  }

  if (local === remote) {
    return "up-to-date";
  }

  const update = await prompts.confirm(
    "Butano is out of date. Update now?",
    false,
  );
  if (!update) return "existing";

  const updateSpinner = spinner();
  updateSpinner.start("Updating Butano");
  await updateRepo(butanoDir);
  updateSpinner.stop("Butano updated");
  return "updated";
}

async function ensureGitAvailable(): Promise<void> {
  const hasGit = await commandExists("git");
  if (!hasGit) {
    throw new Error("git is required but was not found on PATH.");
  }
}

type DependencyStatus = "detected" | "missing-install" | "missing-skipped";

async function handleDependencies(
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

type MakefileOptions = {
  butanoDir: string;
  commonDir?: string;
  projectId: string;
  romMetadata?: RomMetadata;
  targetDir: string;
};

async function maybeCreateMakefile(options: MakefileOptions): Promise<void> {
  const { butanoDir, commonDir, projectId, romMetadata, targetDir } = options;
  const makefilePath = path.join(targetDir, "Makefile");
  const contents = makefileContents(
    butanoDir,
    projectId,
    commonDir,
    romMetadata,
  );
  await fs.writeFile(makefilePath, contents, "utf8");
}

async function maybeInitGit(
  targetDir: string,
  prompts: PromptSession,
  command: Command,
): Promise<boolean> {
  const init = await prompts.confirm("Initialize a git repository?", false);
  if (!init) return false;

  await ensureGitAvailable();
  await run("git", ["init"], { cwd: targetDir });
  command.log("Initialized git repository.");
  return true;
}

function toProjectId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 64);
  return normalized || "project";
}

type RomMetadataInput = {
  defaultCode: string;
  defaultTitle: string;
  flags: {
    romCode?: string;
    romTitle?: string;
  };
  nonInteractive: boolean;
  prompts: PromptSession;
};

async function resolveRomMetadata(
  input: RomMetadataInput,
): Promise<null | RomMetadata> {
  const { defaultCode, defaultTitle, flags, nonInteractive, prompts } = input;
  const hasOverrides = Boolean(flags.romCode || flags.romTitle);

  if (hasOverrides) {
    return {
      code: normalizeRomCode(flags.romCode ?? defaultCode),
      title: normalizeRomTitle(flags.romTitle ?? defaultTitle),
    };
  }

  if (nonInteractive) return null;

  const shouldSet = await prompts.confirm(
    "Set ROM metadata (title/code)?",
    false,
  );
  if (!shouldSet) return null;

  const titleInput = await prompts.text("ROM title", defaultTitle);
  const codeInput = await prompts.text("ROM code", defaultCode);

  return {
    code: normalizeRomCode(codeInput),
    title: normalizeRomTitle(titleInput),
  };
}

function normalizeRomTitle(value: string): string {
  const cleaned = value
    .toUpperCase()
    .replaceAll(/[^A-Z0-9 ]+/g, "")
    .trim();
  return (cleaned || "GBA").slice(0, 12);
}

function normalizeRomCode(value: string): string {
  const cleaned = value.toUpperCase().replaceAll(/[^A-Z0-9]+/g, "");
  const padded = (cleaned || "GAME").padEnd(4, "G");
  return padded.slice(0, 4);
}

function hasUnsafePathCharacters(value: string): boolean {
  return /[^A-Za-z0-9._/\\-]/.test(value);
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

function resolveButanoCommonDir(butanoLibDir: string): string | undefined {
  const parentDir = path.dirname(butanoLibDir);
  const commonDir = path.join(parentDir, "common");
  if (existsSync(commonDir)) {
    return commonDir;
  }

  const nestedCommon = path.join(butanoLibDir, "common");
  if (existsSync(nestedCommon)) {
    return nestedCommon;
  }

  return undefined;
}

async function maybeOverlayExampleTemplate(targetDir: string): Promise<void> {
  if (!existsSync(DEFAULT_EXAMPLE_TEMPLATE)) return;
  await overlayTemplate(DEFAULT_EXAMPLE_TEMPLATE, targetDir);
}

function resolveBundledExampleTemplate(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "..", "..", "assets", "basic-template");
}

function normalizeRelativePath(value: string): string {
  if (!value || value === ".") return "";
  return value.split(path.sep).join("/");
}

function formatButanoStatus(status: ButanoStatus): string {
  switch (status) {
    case "downloaded": {
      return "downloaded";
    }

    case "existing": {
      return "ready";
    }

    case "unknown": {
      return "version unknown";
    }

    case "up-to-date": {
      return "up to date";
    }

    case "updated": {
      return "updated";
    }

    default: {
      return "ready";
    }
  }
}

function formatDependencyStatus(status: DependencyStatus): string {
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
