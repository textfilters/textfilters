#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  validateProfanityLanguageDictionary,
  type ProfanityLanguageDictionaryValidationIssue,
} from "../index.js";

interface CliIo {
  readonly stdout: Pick<NodeJS.WriteStream, "write">;
  readonly stderr: Pick<NodeJS.WriteStream, "write">;
}

export const runValidateLanguageDictionaryCli = async (
  argv: readonly string[],
  io: CliIo = {
    stdout: process.stdout,
    stderr: process.stderr,
  },
): Promise<number> => {
  if (argv.length !== 1 || argv[0] === "--help" || argv[0] === "-h") {
    io.stderr.write(
      "Usage: profanity-validate-language-dictionary <path-to-profanity.json>\n",
    );
    return 2;
  }

  const [filePath] = argv;
  let source: string;

  try {
    source = await readFile(filePath, "utf8");
  } catch (error) {
    io.stderr.write(
      `Could not read dictionary file: ${formatErrorMessage(error)}\n`,
    );
    return 2;
  }

  let dictionary: unknown;

  try {
    dictionary = JSON.parse(source);
  } catch (error) {
    io.stderr.write(`Invalid JSON: ${formatErrorMessage(error)}\n`);
    return 2;
  }

  const issues = validateProfanityLanguageDictionary(dictionary);

  if (issues.length === 0) {
    io.stdout.write("Dictionary is valid.\n");
    return 0;
  }

  io.stderr.write(formatIssues(issues));
  return 1;
};

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
