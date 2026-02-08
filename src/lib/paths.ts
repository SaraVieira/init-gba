import { existsSync, promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PromptSession } from "./prompt.js";

export function expandHome(input: string): string {
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }

  return input;
}

export function defaultButanoDir(): string {
  if (process.env.BUTANO_PATH) {
    return process.env.BUTANO_PATH;
  }

  return path.join(os.homedir(), "Documents", "butano");
}

export function hasUnsafePathCharacters(value: string): boolean {
  return /[^A-Za-z0-9._/\\-]/.test(value);
}

export function resolveButanoLibDir(butanoDir: string): string {
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

export function resolveButanoCommonDir(
  butanoLibDir: string,
): string | undefined {
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

export function resolveBundledExampleTemplate(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "..", "..", "assets", "basic-template");
}

export function normalizeRelativePath(value: string): string {
  if (!value || value === ".") return "";
  return value.split(path.sep).join("/");
}

export async function ensureEmptyTarget(
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
