#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const workspaces = [
  "@textfilters/core",
  "@textfilters/profanity",
  "@textfilters/profanity-ru",
  "@textfilters/profanity-en",
];
const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), "textfilters-tarball-consumer-"),
);

try {
  for (const workspace of workspaces) {
    run(npm, [
      "pack",
      "--silent",
      "--pack-destination",
      temporaryDirectory,
      "--workspace",
      workspace,
    ]);
  }

  const tarballs = (await readdir(temporaryDirectory))
    .filter((filename) => filename.endsWith(".tgz"))
    .map((filename) => path.join(temporaryDirectory, filename));
  assert.equal(tarballs.length, workspaces.length);

  await writeFile(
    path.join(temporaryDirectory, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );
  run(
    npm,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...tarballs],
    temporaryDirectory,
  );

  const consumer = `
    import assert from "node:assert/strict";
    import { combineFilters } from "@textfilters/core";
    import { createProfanityFilter } from "@textfilters/profanity";
    import english from "@textfilters/profanity-en";
    import russian from "@textfilters/profanity-ru";

    const profanity = createProfanityFilter(russian, english);
    assert.equal(profanity.check("х-у-й and faggot"), true);
    assert.equal(profanity.find("😀 х-у-й")[0].start, 3);
    assert.equal(profanity.censor("shit"), "****");
    assert.equal(profanity.process("clean").censored, "clean");
    assert.equal(combineFilters(profanity).censor("faggot"), "******");
  `;
  run(
    process.execPath,
    ["--input-type=module", "--eval", consumer],
    temporaryDirectory,
  );

  console.log("Tarball consumer smoke passed for core, runtime, RU, and EN.");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function run(command, arguments_, cwd = REPO_ROOT) {
  const result = spawnSync(command, arguments_, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
