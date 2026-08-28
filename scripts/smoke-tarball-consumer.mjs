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
  "@textfilters/url",
  "@textfilters/email",
  "@textfilters/phone",
  "@textfilters/profanity",
  "@textfilters/profanity-ru",
  "@textfilters/profanity-en",
  "@textfilters/spam",
];
const obsoleteArtifacts = new Map([
  [
    "@textfilters/core",
    new Set([
      "dist/cache.js",
      "dist/input.js",
      "dist/masking.js",
      "dist/pipeline.js",
      "dist/ranges.js",
      "dist/scanner.js",
      "dist/text-filter.js",
    ]),
  ],
  [
    "@textfilters/phone",
    new Set([
      "dist/json-metadata.js",
      "dist/public-scanner.js",
      "dist/ranges.js",
    ]),
  ],
]);
const temporaryDirectory = await mkdtemp(
  path.join(tmpdir(), "textfilters-tarball-consumer-"),
);

try {
  const packResults = [];
  for (const workspace of workspaces) {
    const output = runCapture(npm, [
      "pack",
      "--json",
      "--pack-destination",
      temporaryDirectory,
      "--workspace",
      workspace,
    ]);
    const [packResult] = parseTrailingJsonArray(output);
    assert.equal(packResult.name, workspace);
    packResults.push(packResult);
  }

  const tarballs = (await readdir(temporaryDirectory))
    .filter((filename) => filename.endsWith(".tgz"))
    .map((filename) => path.join(temporaryDirectory, filename));
  assert.equal(tarballs.length, workspaces.length);

  for (const result of packResults) {
    const paths = result.files.map((file) => file.path);
    assert(paths.includes("package.json"));
    assert(paths.includes("README.md"));
    assert(paths.includes("LICENSE"));
    assert(paths.includes("dist/index.js"));
    assert(paths.includes("dist/index.d.ts"));
    for (const file of paths) {
      assert(
        file === "package.json" ||
          file === "README.md" ||
          file === "LICENSE" ||
          file.startsWith("dist/"),
        `${result.name} contains unexpected tarball file: ${file}`,
      );
      assert(
        !obsoleteArtifacts.get(result.name)?.has(file),
        `${result.name} contains ${file}`,
      );
    }
  }

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
    import * as core from "@textfilters/core";
    import * as emailPackage from "@textfilters/email";
    import * as phonePackage from "@textfilters/phone";
    import * as spamPackage from "@textfilters/spam";
    import * as urlPackage from "@textfilters/url";
    import { createProfanityFilter } from "@textfilters/profanity";
    import english from "@textfilters/profanity-en";
    import russian from "@textfilters/profanity-ru";

    const profanity = createProfanityFilter(russian, english);
    const combined = core.combineFilters(
      urlPackage.filter,
      emailPackage.filter,
      phonePackage.filter,
      profanity,
    );
    const source =
      "Contact user@example.com at https://example.com or +1 202 555 0187";
    const processed = combined.process(source, "#");
    assert.equal(processed.censored.length, source.length);
    assert.deepEqual(
      new Set(processed.matches.map((match) => match.filter)),
      new Set(["url", "email", "phone"]),
    );
    assert.equal(profanity.check("х-у-й and faggot"), true);

    const spam = spamPackage.createSpamGuard({ minIntervalMs: 0 });
    const moderation = core.createModerationPipeline({
      guards: [spam],
      filters: [combined],
    });
    const message = { actorKey: "user:1", text: source, nowMs: 1_000 };
    assert.equal(moderation.process(message).allowed, true);
    assert.deepEqual(moderation.process({ ...message, nowMs: 1_001 }), {
      allowed: false,
      guard: "spam",
      reason: "duplicate",
    });

    assert.equal("createTextPipeline" in core, false);
    assert.equal("createTextRangePipeline" in core, false);
    assert.equal("createUrlScanner" in urlPackage, false);
    assert.equal("createEmailScanner" in emailPackage, false);
    assert.equal("createPhoneFilter" in phonePackage, false);
    assert.equal("createPhoneScanner" in phonePackage, false);
    assert.equal("createSpamFilter" in spamPackage, false);
    assert.equal("createInMemorySpamStateStore" in spamPackage, false);
  `;
  run(
    process.execPath,
    ["--input-type=module", "--eval", consumer],
    temporaryDirectory,
  );

  await writeFile(
    path.join(temporaryDirectory, "consumer.ts"),
    `
      import { combineFilters, createModerationPipeline } from "@textfilters/core";
      import { filter as email } from "@textfilters/email";
      import { filter as phone } from "@textfilters/phone";
      import { createProfanityFilter } from "@textfilters/profanity";
      import english from "@textfilters/profanity-en";
      import russian from "@textfilters/profanity-ru";
      import { createSpamGuard } from "@textfilters/spam";
      import { filter as url } from "@textfilters/url";

      const content = combineFilters(
        url,
        email,
        phone,
        createProfanityFilter(russian, english),
      );
      const moderation = createModerationPipeline({
        guards: [createSpamGuard()],
        filters: [content],
      });
      moderation.process({ actorKey: "typed", text: "hello", nowMs: 0 });
    `,
  );
  await writeFile(
    path.join(temporaryDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        files: ["consumer.ts"],
      },
      null,
      2,
    )}\n`,
  );
  run(
    process.execPath,
    [path.join(REPO_ROOT, "node_modules", "typescript", "bin", "tsc")],
    temporaryDirectory,
  );

  const corePaths = runCapture(
    npm,
    ["ls", "@textfilters/core", "--all", "--parseable"],
    temporaryDirectory,
  )
    .split(/\r?\n/u)
    .filter((line) => line.includes("node_modules/@textfilters/core"));
  assert.equal(corePaths.length, 1, "consumer must resolve one core package");

  console.log(
    "Tarball consumer smoke passed for all eight packages, ESM, TypeScript, and one core copy.",
  );
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

function run(command, arguments_, cwd = REPO_ROOT) {
  const result = spawnSync(command, arguments_, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runCapture(command, arguments_, cwd = REPO_ROOT) {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout.trim();
}

function parseTrailingJsonArray(output) {
  const match = output.match(/(\[\s*\{[\s\S]*\}\s*\])\s*$/u);
  assert(match, "npm pack did not return a JSON result");
  return JSON.parse(match[1]);
}
