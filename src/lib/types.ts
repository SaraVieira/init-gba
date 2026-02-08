import { PromptSession } from "./prompt.js";

export type RomMetadataInput = {
  defaultCode: string;
  defaultTitle: string;
  flags: {
    romCode?: string;
    romTitle?: string;
  };
  nonInteractive: boolean;
  prompts: PromptSession;
};

export type PromptOptions = {
  nonInteractive: boolean;
};

export type MakefileOptions = {
  butanoDir: string;
  commonDir?: string;
  projectId: string;
  romMetadata?: RomMetadata;
  targetDir: string;
};
export type DependencyStatus =
  | "detected"
  | "missing-install"
  | "missing-skipped";

export type RomMetadata = {
  code: string;
  title: string;
};

export type EnsureButanoFlags = {
  butanoRepo?: string;
  skipUpdate?: boolean;
};

export type ButanoStatus =
  | "downloaded"
  | "existing"
  | "unknown"
  | "up-to-date"
  | "updated";
