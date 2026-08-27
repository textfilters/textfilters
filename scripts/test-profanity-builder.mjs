#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), "textfilters-builder-test-"),
);
const packageDirectory = path.join(temporaryDirectory, "profanity-test");
const denyFile = path.join(packageDirectory, "data/deny/family.txt");

try {
  await mkdir(path.dirname(denyFile), { recursive: true });
  await mkdir(path.join(packageDirectory, "data/allow"), { recursive: true });
  await writeFile(denyFile, "# source comment\nＦoo\nMulti space\n");
  await writeFile(
    path.join(packageDirectory, "data/allow/safe.txt"),
    "Safe: user@example.com\n",
  );
  await writeFile(path.join(packageDirectory, "data/aliases.txt"), "α=A\n");

  expectSuccess(runBuilder(packageDirectory));
  const generated = await readFile(
    path.join(packageDirectory, "dist/index.js"),
    "utf8",
  );
  assert.match(generated, /"Ｆoo"/u);
  assert.match(generated, /"Multi space"/u);
  assert.match(generated, /"Safe: user@example.com"/u);
  assert.match(generated, /\[\n\s+"α",\n\s+"A"\n\s+\]/u);

  await writeFile(denyFile, " valid\n");
  expectFailure(runBuilder(packageDirectory), "leading or trailing whitespace");

  for (const invalid of ["word@", "A\u200bB", "Multi  space"]) {
    await writeFile(denyFile, `${invalid}\n`);
    expectFailure(
      runBuilder(packageDirectory),
      "must contain only Unicode letters, numbers, and single spaces",
    );
  }

  await writeFile(denyFile, "duplicate\nduplicate\n");
  expectFailure(runBuilder(packageDirectory), "exactly duplicates");

  console.log("Profanity dictionary builder tests passed.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function runBuilder(packagePath) {
  return spawnSync(
    process.execPath,
    ["scripts/build-profanity-dictionary.mjs", packagePath],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
}

function expectSuccess(result) {
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr);
}

function expectFailure(result, message) {
  if (result.error) throw result.error;
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(message, "u"));
}
