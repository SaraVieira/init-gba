import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ExecOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
};

export async function run(
  cmd: string,
  args: string[],
  options: ExecOptions = {},
): Promise<{ stderr: string; stdout: string }> {
  const { stderr, stdout } = await execFileAsync(cmd, args, {
    cwd: options.cwd,
    encoding: "utf8",
    env: options.env,
  });

  return { stderr, stdout };
}

export async function commandExists(cmd: string): Promise<boolean> {
  const isWin = process.platform === "win32";
  const checker = isWin ? "where" : "command";
  const args = isWin ? [cmd] : ["-v", cmd];

  try {
    await run(checker, args);
    return true;
  } catch {
    return false;
  }
}
