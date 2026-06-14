#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  validateProfanityLanguageDictionary,
  type ProfanityLanguageDictionaryValidationIssue,
} from "../index.js";

type CliOutputFormat = "text" | "json";

interface CliOptions {
  readonly filePath: string;
  readonly format: CliOutputFormat;
  readonly pretty: boolean;
}

interface CliIo {
  readonly stdout: Pick<NodeJS.WriteStream, "write">;
  readonly stderr: Pick<NodeJS.WriteStream, "write">;
}

interface ValidationCliSummary {
  readonly status: "valid" | "invalid" | "error";
  readonly message: string;
  readonly errorCode?: "usage" | "read_error" | "invalid_json";
}

interface ValidationCliReport {
  readonly ok: boolean;
  readonly file: string | null;
  readonly issueCount: number;
  readonly issues: readonly ProfanityLanguageDictionaryValidationIssue[];
  readonly summary: ValidationCliSummary;
}

export const runValidateLanguageDictionaryCli = async (
  argv: readonly string[],
  io: CliIo = {
    stdout: process.stdout,
    stderr: process.stderr,
  },
): Promise<number> => {
  const options = parseArgs(argv);

  if (options === "help" || options === "usage_error") {
    const report = createErrorReport(
      null,
      "usage",
      "Usage: profanity-validate-language-dictionary [--format text|json] [--pretty] <path-to-profanity.json>",
    );

    writeError(report, options === "help" ? "text" : inferFormat(argv), io);
    return 2;
  }

  let source: string;

  try {
    source = await readFile(options.filePath, "utf8");
  } catch (error) {
    writeError(
      createErrorReport(
        options.filePath,
        "read_error",
        `Could not read dictionary file: ${formatErrorMessage(error)}`,
      ),
      options.format,
      io,
      options.pretty,
    );
    return 2;
  }

  let dictionary: unknown;

  try {
    dictionary = JSON.parse(source);
  } catch (error) {
    writeError(
      createErrorReport(
        options.filePath,
        "invalid_json",
        `Invalid JSON: ${formatErrorMessage(error)}`,
      ),
      options.format,
      io,
      options.pretty,
    );
    return 2;
  }

  const issues = validateProfanityLanguageDictionary(dictionary);
  const report = createValidationReport(options.filePath, issues);

  if (issues.length === 0) {
    writeValidationReport(report, options.format, io, options.pretty);
    return 0;
  }

  writeValidationReport(report, options.format, io, options.pretty);
  return 1;
};

const parseArgs = (
  argv: readonly string[],
): CliOptions | "help" | "usage_error" => {
  let format: CliOutputFormat = "text";
  let pretty = false;
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      return "help";
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg === "--format") {
      const value = argv[index + 1];
      if (value !== "text" && value !== "json") {
        return "usage_error";
      }

      format = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--format=")) {
      const value = arg.slice("--format=".length);
      if (value !== "text" && value !== "json") {
        return "usage_error";
      }

      format = value;
      continue;
    }

    if (arg.startsWith("-")) {
      return "usage_error";
    }

    positional.push(arg);
  }

  if (positional.length !== 1) {
    return "usage_error";
  }

  return {
    filePath: positional[0],
    format,
    pretty,
  };
};

const inferFormat = (argv: readonly string[]): CliOutputFormat =>
  argv.includes("--format=json") ||
  argv.some((arg, index) => arg === "--format" && argv[index + 1] === "json")
    ? "json"
    : "text";

const createValidationReport = (
  filePath: string,
  issues: readonly ProfanityLanguageDictionaryValidationIssue[],
): ValidationCliReport => ({
  ok: issues.length === 0,
  file: filePath,
  issueCount: issues.length,
  issues,
  summary:
    issues.length === 0
      ? {
          status: "valid",
          message: "Dictionary is valid.",
        }
      : {
          status: "invalid",
          message: `Dictionary validation failed with ${issues.length} issue${
            issues.length === 1 ? "" : "s"
          }.`,
        },
});

const createErrorReport = (
  filePath: string | null,
  errorCode: NonNullable<ValidationCliSummary["errorCode"]>,
  message: string,
): ValidationCliReport => ({
  ok: false,
  file: filePath,
  issueCount: 0,
  issues: [],
  summary: {
    status: "error",
    errorCode,
    message,
  },
});

const writeValidationReport = (
  report: ValidationCliReport,
  format: CliOutputFormat,
  io: CliIo,
  pretty = false,
): void => {
  if (format === "json") {
    io.stdout.write(formatJson(report, pretty));
    return;
  }

  if (report.ok) {
    io.stdout.write(`${report.summary.message}\n`);
    return;
  }

  io.stderr.write(formatIssues(report.issues));
};

const writeError = (
  report: ValidationCliReport,
  format: CliOutputFormat,
  io: CliIo,
  pretty = false,
): void => {
  if (format === "json") {
    io.stdout.write(formatJson(report, pretty));
    return;
  }

  io.stderr.write(`${report.summary.message}\n`);
};

const formatJson = (report: ValidationCliReport, pretty: boolean): string =>
  `${JSON.stringify(report, null, pretty ? 2 : 0)}\n`;

const formatIssues = (
  issues: readonly ProfanityLanguageDictionaryValidationIssue[],
): string =>
  [
    "Dictionary validation failed:",
    ...issues.map((issue) => `- ${issue.path} ${issue.code}: ${issue.message}`),
    "",
  ].join("\n");

const formatErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const isCliEntrypoint = (
  moduleUrl: string,
  argvPath: string | undefined,
): boolean => {
  if (argvPath === undefined) {
    return false;
  }

  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvPath);
  } catch {
    return false;
  }
};

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  process.exitCode = await runValidateLanguageDictionaryCli(
    process.argv.slice(2),
  );
}
