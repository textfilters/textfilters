#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

run(process.execPath, ["scripts/build-profanity-dictionary.mjs"]);
run(npm, ["run", "build", "--workspace", "@textfilters/core"]);
run(npm, ["run", "build", "--workspace", "@textfilters/profanity"]);

const { createProfanityFilter } = await importFrom(
  "packages/profanity/dist/index.js",
);
const { default: russian } = await importFrom(
  "packages/profanity-ru/dist/index.js",
);
const { default: english } = await importFrom(
  "packages/profanity-en/dist/index.js",
);

const russianFilter = createProfanityFilter(russian);
const englishFilter = createProfanityFilter(english);
const combinedFilter = createProfanityFilter(russian, english);
const denyEntryPattern = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;
assert.deepEqual(
  russian.deny.filter((term) => !denyEntryPattern.test(term)),
  [],
);
assert.deepEqual(
  english.deny.filter((term) => !denyEntryPattern.test(term)),
  [],
);

assert.equal(russianFilter.check("х-у-й"), true);
assert.equal(russianFilter.check("х хороший у яркий й"), false);
assert.equal(russianFilter.check("пизда"), true);
assert.equal(russianFilter.check("п-и-з-д-а"), true);
assert.equal(russianFilter.check("б-л-я-т-ь"), true);
assert.equal(russianFilter.check("пзд"), false);
assert.equal(russianFilter.check("пзд@"), false);
assert.equal(englishFilter.check("fagggot"), true);
assert.equal(englishFilter.check("fagot"), false);
assert.equal(englishFilter.check("s hit"), false);
assert.equal(englishFilter.check("sh it"), false);
assert.equal(englishFilter.check("f u c k"), true);
assert.equal(englishFilter.check("shitake"), false);
assert.deepEqual(
  combinedFilter.find("😀 х-у-й and faggot").map(({ data }) => data.dictionary),
  ["ru", "en"],
);

console.log(
  `Profanity integration passed (${russian.deny.length}/${russian.allow.length} RU, ${english.deny.length}/${english.allow.length} EN).`,
);

function run(command, arguments_) {
  const result = spawnSync(command, arguments_, {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function importFrom(relativePath) {
  return import(pathToFileURL(path.join(REPO_ROOT, relativePath)));
}
