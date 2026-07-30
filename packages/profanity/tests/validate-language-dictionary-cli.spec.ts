import { mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  isCliEntrypoint,
  runValidateLanguageDictionaryCli,
} from "../src/cli/validate-language-dictionary";
import { zzProfanityDictionary } from "../examples/language-pack/src";

const createRecorder = () => {
  let output = "";

  return {
    stream: {
      write(chunk: string) {
        output += chunk;
        return true;
      },
    },
    read: () => output,
  };
};

const writeTempDictionary = async (
  fileName: string,
  contents: string,
): Promise<string> => {
  const directory = await mkdir(
    join(tmpdir(), `profanity-cli-${crypto.randomUUID()}`),
    { recursive: true },
  );
  const filePath = join(directory, fileName);
  await writeFile(filePath, contents, "utf8");
  return filePath;
};

describe("profanity-validate-language-dictionary", () => {
  it("exits 0 for the valid example dictionary", async () => {
    const filePath = await writeTempDictionary(
      "profanity.json",
      JSON.stringify(zzProfanityDictionary, null, 2),
    );
    const stdout = createRecorder();
    const stderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli([filePath], {
        stdout: stdout.stream,
        stderr: stderr.stream,
      }),
    ).resolves.toBe(0);

    expect(stdout.read()).toBe("Dictionary is valid.\n");
    expect(stderr.read()).toBe("");
  });

  it("exits 1 and prints stable issues for an invalid dictionary", async () => {
    const stdout = createRecorder();
    const stderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli(
        ["tests/fixtures/invalid-language-dictionary.json"],
        {
          stdout: stdout.stream,
          stderr: stderr.stream,
        },
      ),
    ).resolves.toBe(1);

    expect(stdout.read()).toBe("");
    expect(stderr.read()).toBe(`Dictionary validation failed:
- language invalid_language: Dictionary language must be a lowercase ISO 639-1 language code.
- rules[0].id missing_id: Rule id is required.
- rules[0].category missing_category: Rule category is required.
- rules[0].severity missing_severity: Rule severity is required.
- rules[0].source invalid_source: Rule source must be a non-empty string or an array of non-empty strings.
- rules[0].match missing_match_mode: Rule match must include strict, loose, or both.
- rules[2].id duplicate_id: Rule id duplicates rules[1].id.
- rules[2].category invalid_category: Rule category must be a supported profanity category.
- rules[2].severity invalid_severity: Rule severity must be a supported profanity severity.
- rules[2].source duplicate_source: Rule source duplicates rules[1].source.
- rules[2].match.loose.stretch invalid_loose_option_value: Loose match option must be true when present.
- rules[2].match.loose.distance unsupported_loose_option: Loose match option is not supported.
`);
  });

  it("prints stable compact JSON reports to stdout", async () => {
    const validPath = await writeTempDictionary(
      "profanity.json",
      JSON.stringify(zzProfanityDictionary, null, 2),
    );
    const validStdout = createRecorder();
    const validStderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli(["--format", "json", validPath], {
        stdout: validStdout.stream,
        stderr: validStderr.stream,
      }),
    ).resolves.toBe(0);

    expect(JSON.parse(validStdout.read())).toEqual({
      ok: true,
      file: validPath,
      issueCount: 0,
      issues: [],
      summary: {
        status: "valid",
        message: "Dictionary is valid.",
      },
    });
    expect(validStderr.read()).toBe("");

    const invalidStdout = createRecorder();
    const invalidStderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli(
        ["tests/fixtures/invalid-language-dictionary.json", "--format=json"],
        {
          stdout: invalidStdout.stream,
          stderr: invalidStderr.stream,
        },
      ),
    ).resolves.toBe(1);

    expect(JSON.parse(invalidStdout.read())).toMatchObject({
      ok: false,
      file: "tests/fixtures/invalid-language-dictionary.json",
      issueCount: 12,
      summary: {
        status: "invalid",
        message: "Dictionary validation failed with 12 issues.",
      },
    });
    expect(JSON.parse(invalidStdout.read()).issues[0]).toEqual({
      path: "language",
      code: "invalid_language",
      message:
        "Dictionary language must be a lowercase ISO 639-1 language code.",
    });
    expect(invalidStderr.read()).toBe("");
  });

  it("pretty-prints JSON reports when requested", async () => {
    const filePath = await writeTempDictionary(
      "profanity.json",
      JSON.stringify(zzProfanityDictionary),
    );
    const stdout = createRecorder();
    const stderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli(
        ["--format=json", "--pretty", filePath],
        {
          stdout: stdout.stream,
          stderr: stderr.stream,
        },
      ),
    ).resolves.toBe(0);

    expect(stdout.read()).toContain('\n  "ok": true,\n');
    expect(stderr.read()).toBe("");
  });

  it("exits 2 for usage and JSON errors", async () => {
    const usageStdout = createRecorder();
    const usageStderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli([], {
        stdout: usageStdout.stream,
        stderr: usageStderr.stream,
      }),
    ).resolves.toBe(2);

    expect(usageStdout.read()).toBe("");
    expect(usageStderr.read()).toBe(
      "Usage: profanity-validate-language-dictionary [--format text|json] [--pretty] <path-to-profanity.json>\n",
    );

    const jsonPath = await writeTempDictionary("profanity.json", "{");
    const jsonStdout = createRecorder();
    const jsonStderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli([jsonPath], {
        stdout: jsonStdout.stream,
        stderr: jsonStderr.stream,
      }),
    ).resolves.toBe(2);

    expect(jsonStdout.read()).toBe("");
    expect(jsonStderr.read()).toMatch(/^Invalid JSON: /u);
  });

  it("exits 2 with JSON error reports for usage and JSON errors", async () => {
    const usageStdout = createRecorder();
    const usageStderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli(["--format=json"], {
        stdout: usageStdout.stream,
        stderr: usageStderr.stream,
      }),
    ).resolves.toBe(2);

    expect(JSON.parse(usageStdout.read())).toEqual({
      ok: false,
      file: null,
      issueCount: 0,
      issues: [],
      summary: {
        status: "error",
        errorCode: "usage",
        message:
          "Usage: profanity-validate-language-dictionary [--format text|json] [--pretty] <path-to-profanity.json>",
      },
    });
    expect(usageStderr.read()).toBe("");

    const jsonPath = await writeTempDictionary("profanity.json", "{");
    const jsonStdout = createRecorder();
    const jsonStderr = createRecorder();

    await expect(
      runValidateLanguageDictionaryCli(["--format=json", jsonPath], {
        stdout: jsonStdout.stream,
        stderr: jsonStderr.stream,
      }),
    ).resolves.toBe(2);

    expect(JSON.parse(jsonStdout.read())).toMatchObject({
      ok: false,
      file: jsonPath,
      issueCount: 0,
      issues: [],
      summary: {
        status: "error",
        errorCode: "invalid_json",
      },
    });
    expect(jsonStderr.read()).toBe("");
  });

  it("recognizes npm bin symlinks as the CLI entrypoint", async () => {
    const directory = await mkdir(
      join(tmpdir(), `profanity-cli-bin-${crypto.randomUUID()}`),
      { recursive: true },
    );
    const targetPath = join(directory, "validate-language-dictionary.js");
    const symlinkPath = join(
      directory,
      "profanity-validate-language-dictionary",
    );

    await writeFile(targetPath, "#!/usr/bin/env node\n", "utf8");
    await symlink(targetPath, symlinkPath);

    expect(isCliEntrypoint(pathToFileURL(targetPath).href, symlinkPath)).toBe(
      true,
    );
  });
});
