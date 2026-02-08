import {
  cancel,
  confirm as clackConfirm,
  text as clackText,
  isCancel,
} from "@clack/prompts";

export type PromptOptions = {
  nonInteractive: boolean;
};

export class PromptSession {
  private nonInteractive: boolean;

  constructor(options: PromptOptions) {
    this.nonInteractive = options.nonInteractive;
  }

  close(): void {
    // clack manages stdin/stdout internally
  }

  async confirm(message: string, defaultValue = false): Promise<boolean> {
    if (this.nonInteractive) {
      return defaultValue;
    }

    const value = await clackConfirm({
      active: "Yes",
      inactive: "No",
      initialValue: defaultValue,
      message,
    });
    if (isCancel(value)) {
      cancel("Operation cancelled.");
      throw new Error("Operation cancelled.");
    }

    return value;
  }

  async text(message: string, defaultValue?: string): Promise<string> {
    if (this.nonInteractive) {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Missing required input: ${message}`);
    }

    const value = await clackText({
      initialValue: defaultValue,
      message,
      validate(inputValue) {
        if (defaultValue !== undefined) return;
        if (!inputValue || inputValue.trim().length === 0) {
          return "Value is required";
        }
      },
    });
    if (isCancel(value)) {
      cancel("Operation cancelled.");
      throw new Error("Operation cancelled.");
    }

    if (typeof value !== "string") {
      return defaultValue ?? "";
    }

    if (!value.trim() && defaultValue !== undefined) {
      return defaultValue;
    }

    return value.trim();
  }
}
