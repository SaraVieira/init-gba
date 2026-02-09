import { box, intro, note } from "@clack/prompts";
import { Command } from "@oclif/core";
import { gray, green, yellow } from "ansis";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import { ensureButano, formatButanoStatus } from "../lib/butano.js";
import { DEFAULT_EXAMPLE_TEMPLATE, FLAGS } from "../lib/consts.js";
import { formatDependencyStatus, handleDependencies } from "../lib/deps.js";
import { maybeInitGit } from "../lib/git.js";
import {
  defaultButanoDir,
  ensureEmptyTarget,
  expandHome,
  hasUnsafePathCharacters,
  normalizeRelativePath,
  resolveButanoCommonDir,
  resolveButanoLibDir,
} from "../lib/paths.js";
import { PromptSession } from "../lib/prompt.js";
import { resolveRomMetadata } from "../lib/rom.js";
import {
  copyTemplate,
  makefileContents,
  overlayTemplate,
  removeGitDir,
  renamePathsWithToken,
  replaceTokenInTextFiles,
  toRomCode,
  toRomTitle,
} from "../lib/template.js";
import { MakefileOptions } from "../lib/types.js";

export default class Create extends Command {
  static description = "Create a new GBA project using Butano";
  static flags = FLAGS;

  async run(): Promise<void> {
    const { flags } = await this.parse(Create);

    const interactive = process.stdin.isTTY;
    const nonInteractive = flags.nonInteractive || flags.yes || !interactive;
    const prompts = new PromptSession({ nonInteractive });
    const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

    try {
      intro(`
        ██╗    ██╗███████╗██╗      ██████╗ ██████╗ ███╗   ███╗███████╗██╗
        ██║    ██║██╔════╝██║     ██╔════╝██╔═══██╗████╗ ████║██╔════╝██║
        ██║ █╗ ██║█████╗  ██║     ██║     ██║   ██║██╔████╔██║█████╗  ██║
        ██║███╗██║██╔══╝  ██║     ██║     ██║   ██║██║╚██╔╝██║██╔══╝  ╚═╝
        ╚███╔███╔╝███████╗███████╗╚██████╗╚██████╔╝██║ ╚═╝ ██║███████╗██╗
         ╚══╝╚══╝ ╚══════╝╚══════╝ ╚═════╝ ╚═════╝ ╚═╝     ╚═╝╚══════╝╚═╝
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

function toProjectId(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .slice(0, 64);
  return normalized || "project";
}

async function maybeOverlayExampleTemplate(targetDir: string): Promise<void> {
  if (!existsSync(DEFAULT_EXAMPLE_TEMPLATE)) return;
  await overlayTemplate(DEFAULT_EXAMPLE_TEMPLATE, targetDir);
}
