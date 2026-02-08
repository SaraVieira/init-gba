import { spinner } from "@clack/prompts";
import { Command } from "@oclif/core";
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import { DEFAULT_BUTANO_REPO } from "./consts.js";
import {
  cloneRepo,
  ensureGitAvailable,
  getLocalHead,
  getRemoteHead,
  isGitRepo,
  updateRepo,
} from "./git.js";
import { PromptSession } from "./prompt.js";
import { ButanoStatus, EnsureButanoFlags } from "./types.js";

export async function ensureButano(
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

export function formatButanoStatus(status: ButanoStatus): string {
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
