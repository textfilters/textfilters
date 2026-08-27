#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const PACKAGES_ROOT = path.join(REPO_ROOT, "packages");
const DENY_ENTRY_RE = /^[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*$/u;
const checkOnly = process.argv.includes("--check");
const requestedPackages = process.argv
  .slice(2)
  .filter((argument) => argument !== "--check");

const packageDirectories =
  requestedPackages.length > 0
    ? requestedPackages.map((directory) => path.resolve(REPO_ROOT, directory))
    : await discoverLanguagePackages();

if (packageDirectories.length === 0) {
  throw new Error("No profanity language packages were found.");
}

for (const packageDirectory of packageDirectories) {
  await buildDictionary(packageDirectory);
}

async function discoverLanguagePackages() {
  const entries = await readdir(PACKAGES_ROOT, { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isDirectory() && /^profanity-[a-z][a-z0-9-]*$/u.test(entry.name),
    )
    .map((entry) => path.join(PACKAGES_ROOT, entry.name))
    .sort(comparePaths);
}

async function buildDictionary(packageDirectory) {
  const packageName = path.basename(packageDirectory);
  const match = /^profanity-([a-z][a-z0-9-]*)$/u.exec(packageName);
  if (!match) {
    throw new Error(
      `Language package directory must use profanity-<id>: ${packageName}`,
    );
  }

  const id = match[1];
  const dataDirectory = path.join(packageDirectory, "data");
  const deny = await readSide(path.join(dataDirectory, "deny"), "deny");
  const allow = await readSide(path.join(dataDirectory, "allow"), "allow");
  const aliases = await readAliases(path.join(dataDirectory, "aliases.txt"));
  const outputs = [
    [
      path.join(packageDirectory, "dist/index.js"),
      renderJavascript({ id, deny, allow, aliases }),
    ],
    [path.join(packageDirectory, "dist/index.d.ts"), renderDeclaration(id)],
  ];

  if (checkOnly) {
    for (const [file, expected] of outputs) {
      const actual = await readFile(file, "utf8").catch(() => undefined);
      if (actual !== expected) {
        throw new Error(
          `${relative(file)} is missing or does not match the dictionary sources.`,
        );
      }
    }
    console.log(`Validated ${packageName} dictionary output.`);
    return;
  }

  await mkdir(path.join(packageDirectory, "dist"), { recursive: true });
  for (const [file, content] of outputs) {
    await writeFile(file, content, "utf8");
  }
  console.log(
    `Built ${packageName} dictionary (${deny.length} deny, ${allow.length} allow).`,
  );
}

async function readSide(directory, side) {
  const entries = await readdir(directory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".txt"))
    .map((entry) => entry.name)
    .sort(comparePaths);

  if (filenames.length === 0) {
    throw new Error(
      `${relative(directory)} must contain at least one .txt file.`,
    );
  }

  const values = [];
  const seen = new Map();
  for (const filename of filenames) {
    validateNfcFilename(directory, filename);
    const file = path.join(directory, filename);
    for (const line of parseLines(await readUtf8(file), file)) {
      if (side === "deny" && !DENY_ENTRY_RE.test(line.value)) {
        throw new Error(
          `${relative(file)}:${line.number} deny entry must contain only Unicode letters, numbers, and single spaces between words.`,
        );
      }
      const first = seen.get(line.value);
      if (first) {
        throw new Error(
          `${relative(file)}:${line.number} exactly duplicates ${first} on ${side}.`,
        );
      }
      seen.set(line.value, `${relative(file)}:${line.number}`);
      values.push(line.value);
    }
  }
  return values;
}

async function readAliases(file) {
  const aliases = [];
  const sources = new Map();

  for (const line of parseLines(await readUtf8(file), file)) {
    const separator = line.value.indexOf("=");
    if (
      separator <= 0 ||
      separator !== line.value.lastIndexOf("=") ||
      separator === line.value.length - 1
    ) {
      throw new Error(
        `${relative(file)}:${line.number} has invalid alias syntax.`,
      );
    }

    const from = line.value.slice(0, separator);
    const to = line.value.slice(separator + 1);
    const first = sources.get(from);
    if (first) {
      throw new Error(
        `${relative(file)}:${line.number} exactly duplicates alias source from ${first}.`,
      );
    }
    sources.set(from, `${relative(file)}:${line.number}`);
    aliases.push([from, to]);
  }

  return aliases;
}

function parseLines(source, file) {
  const lines = source.replace(/^\ufeff/u, "").split(/\r?\n/u);
  const values = [];

  for (const [index, value] of lines.entries()) {
    if (value === "" || value.startsWith("#")) continue;
    if (value.trim() !== value) {
      throw new Error(
        `${relative(file)}:${index + 1} has leading or trailing whitespace.`,
      );
    }
    values.push({ value, number: index + 1 });
  }

  return values;
}

function validateNfcFilename(directory, filename) {
  if (filename !== filename.normalize("NFC")) {
    throw new Error(`${relative(path.join(directory, filename))} is not NFC.`);
  }
}

async function readUtf8(file) {
  const source = await readFile(file);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(source);
  } catch (error) {
    throw new Error(`${relative(file)} must contain valid UTF-8.`, {
      cause: error,
    });
  }
}

function renderJavascript(dictionary) {
  return `const dictionary = ${JSON.stringify(dictionary, null, 2)};\n\nexport { dictionary };\nexport default dictionary;\n`;
}

function renderDeclaration(id) {
  return `declare const dictionary: {\n  readonly id: ${JSON.stringify(id)};\n  readonly deny: readonly string[];\n  readonly allow: readonly string[];\n  readonly aliases: readonly (readonly [from: string, to: string])[];\n};\n\nexport { dictionary };\nexport default dictionary;\n`;
}

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function relative(file) {
  return path.relative(REPO_ROOT, file).split(path.sep).join("/");
}
