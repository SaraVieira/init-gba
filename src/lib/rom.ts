import { RomMetadata, RomMetadataInput } from "./types.js";

export async function resolveRomMetadata(
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
