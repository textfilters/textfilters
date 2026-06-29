import { performance } from "node:perf_hooks";
import {
  createProfanityFilter,
  createProfanityScanner,
} from "../dist/index.js";

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;

const DEFAULT_MATCH = "\u0431\u043b\u044f\u0434\u044c";
const SHORT_CLEAN = "Hello world";
const CYRILLIC_CLEAN = "Обычный текст без нарушений";
const LONG_CLEAN = "The quick brown fox jumps over the lazy dog. ".repeat(50);
const SHORT_MATCH = `hello ${DEFAULT_MATCH}`;
const LOOSE_MATCH = "hello б л я д ь";
const LONG_LATE_MATCH =
  "The quick brown fox jumps over the lazy dog. ".repeat(50) + DEFAULT_MATCH;

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
  console.log("\nprofanity benchmark");
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

const filter = createProfanityFilter();
const scanner = createProfanityScanner({ filter });
const input = (text) => ({ text, codePoints: Array.from(text) });

printResults([
  bench(
    "createProfanityFilter()",
    () => createProfanityFilter(),
    SETUP_ITERATIONS,
  ),
  bench("check short clean", () => filter.check(SHORT_CLEAN)),
  bench("check cyrillic clean", () => filter.check(CYRILLIC_CLEAN)),
  bench("check long clean", () => filter.check(LONG_CLEAN)),
  bench("check short match", () => filter.check(SHORT_MATCH)),
  bench("check loose match", () => filter.check(LOOSE_MATCH)),
  bench("check long late match", () => filter.check(LONG_LATE_MATCH)),
  bench("scanner check short clean", () => scanner.check(input(SHORT_CLEAN))),
  bench("scanner check short match", () => scanner.check(input(SHORT_MATCH))),
  bench("scanner scan short match", () => scanner.scan(input(SHORT_MATCH))),
  bench("analyze short match", () => filter.analyze(SHORT_MATCH)),
  bench("censor short match", () => filter.censor(SHORT_MATCH)),
  bench("check minSeverity high", () =>
    filter.check(SHORT_MATCH, { minSeverity: "high" }),
  ),
]);

console.log("\nbenchmark complete\n");
