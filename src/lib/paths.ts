import os from "node:os";
import path from "node:path";

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
