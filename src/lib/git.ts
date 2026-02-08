import { Command } from "@oclif/core";
import { existsSync } from "node:fs";
import path from "node:path";

import { commandExists, run } from "./exec.js";
import { PromptSession } from "./prompt.js";

export async function isGitRepo(dir: string): Promise<boolean> {
  return existsSync(path.join(dir, ".git"));
}

export async function getLocalHead(dir: string): Promise<null | string> {
  try {
    const { stdout } = await run("git", ["rev-parse", "HEAD"], { cwd: dir });
    const hash = stdout.trim();
    return hash.length > 0 ? hash : null;
  } catch {
    return null;
  }
}

export async function getRemoteHead(dir: string): Promise<null | string> {
  try {
    const { stdout } = await run("git", ["ls-remote", "origin", "HEAD"], {
      cwd: dir,
    });
    const hash = stdout.trim().split(/\s+/)[0];
    return hash && hash.length > 0 ? hash : null;
  } catch {
    return null;
  }
}

export async function getDefaultRemoteBranch(
  dir: string,
): Promise<null | string> {
  try {
    const { stdout } = await run(
      "git",
      ["symbolic-ref", "refs/remotes/origin/HEAD"],
      { cwd: dir },
    );
    const ref = stdout.trim();
    if (!ref) return null;
    const parts = ref.split("/").slice(3);
    return parts.join("/") || null;
  } catch {
    return null;
  }
}

export async function updateRepo(dir: string): Promise<void> {
  await run("git", ["fetch", "--depth", "1", "origin"], { cwd: dir });
  const branch = (await getDefaultRemoteBranch(dir)) ?? "main";
  try {
    await run("git", ["reset", "--hard", `origin/${branch}`], { cwd: dir });
  } catch {
    await run("git", ["reset", "--hard", "origin/master"], { cwd: dir });
  }
}

export async function cloneRepo(url: string, dir: string): Promise<void> {
  await run("git", ["clone", "--depth", "1", url, dir]);
}

export async function ensureGitAvailable(): Promise<void> {
  const hasGit = await commandExists("git");
  if (!hasGit) {
    throw new Error("git is required but was not found on PATH.");
  }
}

export async function maybeInitGit(
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
