import { performance } from "node:perf_hooks";
import { createProfanityFilter } from "../dist/index.js";

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;

const DEFAULT_MATCH = "\u0431\u043b\u044f\u0434\u044c";
const SHORT_CLEAN = "Hello world";
const LONG_CLEAN = "The quick brown fox jumps over the lazy dog. ".repeat(50);
const SHORT_MATCH = `hello ${DEFAULT_MATCH}`;
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

printResults([
  bench(
    "createProfanityFilter()",
    () => createProfanityFilter(),
    SETUP_ITERATIONS,
  ),
  bench("check short clean", () => filter.check(SHORT_CLEAN)),
  bench("check long clean", () => filter.check(LONG_CLEAN)),
  bench("check short match", () => filter.check(SHORT_MATCH)),
  bench("check long late match", () => filter.check(LONG_LATE_MATCH)),
]);

console.log("\nbenchmark complete\n");
