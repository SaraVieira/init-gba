import { promises as fs } from "node:fs";
import path from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".bat",
  ".c",
  ".cmake",
  ".cpp",
  ".h",
  ".hpp",
  ".ini",
  ".json",
  ".mak",
  ".markdown",
  ".md",
  ".mk",
  ".sh",
  ".toml",
  ".txt",
  ".yaml",
  ".yml",
]);

export async function copyTemplate(
  srcDir: string,
  destDir: string,
): Promise<void> {
  await copyDir(srcDir, destDir);
}

export async function overlayTemplate(
  srcDir: string,
  destDir: string,
): Promise<void> {
  await copyDir(srcDir, destDir);
}

export async function removeGitDir(targetDir: string): Promise<void> {
  const gitPath = path.join(targetDir, ".git");
  try {
    await fs.rm(gitPath, { force: true, recursive: true });
  } catch {
    // ignore
  }
}

export async function replaceTokenInTextFiles(
  targetDir: string,
  token: string,
  replacement: string,
): Promise<number> {
  const replacements = new Map<string, string>([[token, replacement]]);
  const upper = token.toUpperCase();
  const lower = token.toLowerCase();

  if (upper !== token) {
    replacements.set(upper, replacement.toUpperCase());
  }

  if (lower !== token) {
    replacements.set(lower, replacement.toLowerCase());
  }

  const entries = await listFiles(targetDir);
  const results = await Promise.all(
    entries.map(async (filePath) => {
      if (!isTextFile(filePath)) return 0;

      const data = await fs.readFile(filePath);
      if (data.includes(0)) return 0;

      const content = data.toString("utf8");
      let next = content;
      for (const [needle, value] of replacements.entries()) {
        if (needle.length === 0) continue;
        next = next.split(needle).join(value);
      }

      if (next !== content) {
        await fs.writeFile(filePath, next, "utf8");
        return 1;
      }

      return 0;
    }),
  );

  let total = 0;
  for (const value of results) {
    total += value;
  }

  return total;
}

export async function renamePathsWithToken(
  targetDir: string,
  token: string,
  replacement: string,
): Promise<number> {
  if (!token) return 0;
  let renamed = 0;
  const entries = await listAllPaths(targetDir);
  const operations = entries
    .map((entry) => {
      const base = path.basename(entry);
      if (!base.includes(token)) return null;

      const nextBase = base.split(token).join(replacement);
      const nextPath = path.join(path.dirname(entry), nextBase);
      if (nextPath === entry) return null;
      return { entry, nextPath };
    })
    .filter((operation): operation is RenameOperation => operation !== null);

  for (const operation of operations) {
    // eslint-disable-next-line no-await-in-loop
    await fs.rename(operation.entry, operation.nextPath);
    renamed += 1;
  }

  return renamed;
}

export type RomMetadata = {
  code: string;
  title: string;
};

export function makefileContents(
  butanoDir: string,
  projectId: string,
  commonDir?: string,
  romMetadata?: RomMetadata,
): string {
  const escapedPath = escapeMakePath(butanoDir);
  const escapedCommonDir = commonDir ? escapeMakePath(commonDir) : null;
  const romTitle = romMetadata?.title ?? toRomTitle(projectId);
  const romCode = romMetadata?.code ?? toRomCode(projectId);
  const sources = "src";
  const includes = escapedCommonDir
    ? `include ${escapedCommonDir}/include`
    : "include";
  const graphics = escapedCommonDir
    ? `graphics ${escapedCommonDir}/graphics`
    : "graphics";
  const audio = escapedCommonDir ? `audio ${escapedCommonDir}/audio` : "audio";
  const dmgAudio = escapedCommonDir
    ? `dmg_audio ${escapedCommonDir}/dmg_audio`
    : "dmg_audio";

  return `#---------------------------------------------------------------------------------------------------------------------
# TARGET is the name of the output.
# BUILD is the directory where object files & intermediate files will be placed.
# LIBBUTANO is the main directory of butano library (https://github.com/GValiente/butano).
# PYTHON is the path to the python interpreter.
# SOURCES is a list of directories containing source code.
# INCLUDES is a list of directories containing extra header files.
# DATA is a list of directories containing binary data files with *.bin extension.
# GRAPHICS is a list of files and directories containing files to be processed by grit.
# AUDIO is a list of files and directories containing files to be processed by the audio backend.
# AUDIOBACKEND specifies the backend used for audio playback. Supported backends: maxmod, aas, null.
# AUDIOTOOL is the path to the tool used process the audio files.
# DMGAUDIO is a list of files and directories containing files to be processed by the DMG audio backend.
# DMGAUDIOBACKEND specifies the backend used for DMG audio playback. Supported backends: default, null.
# ROMTITLE is a uppercase ASCII, max 12 characters text string containing the output ROM title.
# ROMCODE is a uppercase ASCII, max 4 characters text string containing the output ROM code.
# USERFLAGS is a list of additional compiler flags:
#     Pass -flto to enable link-time optimization.
#     Pass -O0 or -Og to try to make debugging work.
# USERCXXFLAGS is a list of additional compiler flags for C++ code only.
# USERASFLAGS is a list of additional assembler flags.
# USERLDFLAGS is a list of additional linker flags:
#     Pass -flto=<number_of_cpu_cores> to enable parallel link-time optimization.
# USERLIBDIRS is a list of additional directories containing libraries.
#     Each libraries directory must contains include and lib subdirectories.
# USERLIBS is a list of additional libraries to link with the project.
# DEFAULTLIBS links standard system libraries when it is not empty.
# STACKTRACE enables stack trace logging when it is not empty.
# USERBUILD is a list of additional directories to remove when cleaning the project.
# EXTTOOL is an optional command executed before processing audio, graphics and code files.
#
# All directories are specified relative to the project directory where the makefile is found.
#---------------------------------------------------------------------------------------------------------------------
TARGET        :=  $(notdir $(CURDIR))
BUILD         :=  build
LIBBUTANO     :=  ${escapedPath}
PYTHON        :=  python3
SOURCES       :=  ${sources}
INCLUDES      :=  ${includes}
DATA          :=
GRAPHICS      :=  ${graphics}
AUDIO         :=  ${audio}
AUDIOBACKEND  :=  maxmod
AUDIOTOOL     :=
DMGAUDIO      :=  ${dmgAudio}
DMGAUDIOBACKEND :=  default
ROMTITLE      :=  ${romTitle}
ROMCODE       :=  ${romCode}
USERFLAGS     :=
USERCXXFLAGS  :=
USERASFLAGS   :=
USERLDFLAGS   :=
USERLIBDIRS   :=
USERLIBS      :=
DEFAULTLIBS   :=
STACKTRACE    :=
USERBUILD     :=
EXTTOOL       :=

#---------------------------------------------------------------------------------------------------------------------
# Export absolute butano path:
#---------------------------------------------------------------------------------------------------------------------
ifndef LIBBUTANOABS
\texport LIBBUTANOABS\t:=\t$(realpath $(LIBBUTANO))
endif

#---------------------------------------------------------------------------------------------------------------------
# Include main makefile:
#---------------------------------------------------------------------------------------------------------------------
include $(LIBBUTANOABS)/butano.mak
`;
}

export function toRomTitle(projectId: string): string {
  const normalized = projectId.replaceAll(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return (normalized || "GBA").slice(0, 12);
}

export function toRomCode(projectId: string): string {
  const normalized = projectId.replaceAll(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const padded = (normalized || "GAME").padEnd(4, "G");
  return padded.slice(0, 4);
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listFiles(fullPath);
      }

      if (entry.isFile()) {
        return [fullPath];
      }

      return [];
    }),
  );

  return nested.flat();
}

async function listAllPaths(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const childPaths = await listAllPaths(fullPath);
        return [...childPaths, fullPath];
      }

      return [fullPath];
    }),
  );

  return nested.flat().sort((a, b) => b.length - a.length);
}

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  if (TEXT_EXTENSIONS.has(ext)) return true;

  const base = path.basename(filePath);
  return base === "CMakeLists.txt" || base === "Makefile";
}

function escapeMakePath(input: string): string {
  return input.replaceAll(/\s/g, String.raw`\ `);
}

type RenameOperation = { entry: string; nextPath: string };

async function copyDir(srcDir: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const entries = await fs.readdir(srcDir, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(srcDir, entry.name);
      const destPath = path.join(destDir, entry.name);
      if (entry.isDirectory()) {
        await copyDir(srcPath, destPath);
      } else if (entry.isFile()) {
        await fs.copyFile(srcPath, destPath);
      }
    }),
  );
}
