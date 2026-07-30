import { performance } from "node:perf_hooks";
import { createEmailFilter, createEmailScanner } from "../dist/index.js";

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;

const SHORT_CLEAN = "Hello world";
const LONG_CLEAN = "The quick brown fox jumps over the lazy dog. ".repeat(50);
const NO_DOT_AT = "Contact user@example for details";
const DIRECT_EMAIL = "Contact user@example.com for details";
const OBFUSCATED_EMAIL = "Contact user [at] example [dot] com for details";
const LATE_MATCH =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(40) +
  "Contact alerts@example.com now";

function bench(label, fn, iterations = ITERATIONS) {
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  return { label, iterations, totalMs, avgMs, opsPerSec };
}

function printResults(results) {
  console.log("\nemail benchmark");
  console.log(
    `${"label".padEnd(40)} ${"iter".padStart(7)} ${"total ms".padStart(10)} ${"avg ms".padStart(10)} ${"ops/sec".padStart(10)}`,
  );
  console.log("-".repeat(81));
  for (const result of results) {
    console.log(
      `${result.label.padEnd(40)} ${String(result.iterations).padStart(7)} ${result.totalMs.toFixed(2).padStart(10)} ${result.avgMs.toFixed(4).padStart(10)} ${String(result.opsPerSec).padStart(10)}`,
    );
  }
}

const filter = createEmailFilter();
const scanner = createEmailScanner();
const input = (text) => ({ text, codePoints: Array.from(text) });
const hintedInput = (text) => ({
  text,
  codePoints: Array.from(text),
  hints: {
    textLength: text.length,
    hasNonAscii: /[^\x00-\x7f]/u.test(text),
    hasAtSign: text.includes("@"),
    hasDot: text.includes("."),
  },
});

printResults([
  bench("createEmailFilter()", () => createEmailFilter(), SETUP_ITERATIONS),
  bench("createEmailScanner()", () => createEmailScanner(), SETUP_ITERATIONS),
  bench("check short clean", () => scanner.check(input(SHORT_CLEAN))),
  bench("check hinted short clean", () =>
    scanner.check(hintedInput(SHORT_CLEAN)),
  ),
  bench("check long clean", () => scanner.check(input(LONG_CLEAN))),
  bench("check no-dot at text", () => scanner.check(input(NO_DOT_AT))),
  bench("check direct email", () => scanner.check(input(DIRECT_EMAIL))),
  bench("check late-match email", () => scanner.check(input(LATE_MATCH))),
  bench("censor short clean", () => filter.censor(SHORT_CLEAN)),
  bench("censor long clean", () => filter.censor(LONG_CLEAN)),
  bench("censor no-dot at text", () => filter.censor(NO_DOT_AT)),
  bench("censor direct email", () => filter.censor(DIRECT_EMAIL)),
  bench("censor obfuscated email", () => filter.censor(OBFUSCATED_EMAIL)),
  bench("censor late-match email", () => filter.censor(LATE_MATCH)),
]);

console.log("\nbenchmark complete\n");
