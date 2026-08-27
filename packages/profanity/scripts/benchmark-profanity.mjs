import { performance } from "node:perf_hooks";
import englishDictionary from "../../profanity-en/dist/index.js";
import russianDictionary from "../../profanity-ru/dist/index.js";
import { createProfanityFilter } from "../dist/index.js";

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;
const LARGE_INPUT_ITERATIONS = 100;
const MEMORY_FILTERS = 25;

const SHORT_CLEAN = "Hello world";
const LONG_CLEAN = "The quick brown fox jumps over the lazy dog. ".repeat(50);
const EARLY_MATCH = `хуй ${LONG_CLEAN}`;
const LATE_MATCH = `${LONG_CLEAN} shit`;
const PHRASE_INPUT = "еб твою мать";
const OBFUSCATED_INPUT = "х-у-й and f-υ-c-k";
const EXACT_ALLOW_INPUT = "сука породы лабрадор";
const MANY_ALLOW_AND_DENY_INPUT = Array.from(
  { length: 256 },
  () => "safe bad bad",
).join(" ");

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

function measureRetainedMemory(createFilter) {
  globalThis.gc?.();
  const before = process.memoryUsage().heapUsed;
  const filters = Array.from({ length: MEMORY_FILTERS }, createFilter);
  globalThis.gc?.();
  const after = process.memoryUsage().heapUsed;

  return {
    filters,
    bytesPerFilter: Math.max(0, after - before) / MEMORY_FILTERS,
  };
}

const createRussianFilter = () => createProfanityFilter(russianDictionary);
const createEnglishFilter = () => createProfanityFilter(englishDictionary);
const createFullFilter = () =>
  createProfanityFilter(russianDictionary, englishDictionary);
const filter = createFullFilter();
const manyAllowsFilter = createProfanityFilter({
  id: "many-allows",
  deny: ["bad"],
  allow: ["safe bad"],
});

printResults([
  bench(
    "construct full Russian dictionary",
    createRussianFilter,
    SETUP_ITERATIONS,
  ),
  bench(
    "construct full English dictionary",
    createEnglishFilter,
    SETUP_ITERATIONS,
  ),
  bench(
    "construct full RU+EN dictionaries",
    createFullFilter,
    SETUP_ITERATIONS,
  ),
  bench("check short clean", () => filter.check(SHORT_CLEAN)),
  bench("check long clean", () => filter.check(LONG_CLEAN)),
  bench("check early match", () => filter.check(EARLY_MATCH)),
  bench("check late match", () => filter.check(LATE_MATCH)),
  bench("check phrase input", () => filter.check(PHRASE_INPUT)),
  bench("check obfuscated input", () => filter.check(OBFUSCATED_INPUT)),
  bench("check exact allow input", () => filter.check(EXACT_ALLOW_INPUT)),
  bench("find late match", () => filter.find(LATE_MATCH)),
  bench(
    "find many allow ranges and deny matches",
    () => manyAllowsFilter.find(MANY_ALLOW_AND_DENY_INPUT),
    LARGE_INPUT_ITERATIONS,
  ),
  bench("censor late match", () => filter.censor(LATE_MATCH)),
  bench("process phrase input", () => filter.process(PHRASE_INPUT)),
]);

const memory = measureRetainedMemory(createFullFilter);
console.log("\nretained construction memory");
console.log(`filters retained: ${memory.filters.length}`);
console.log(
  `approximate heap bytes per full RU+EN filter: ${Math.round(memory.bytesPerFilter)}`,
);

console.log("\nbenchmark complete\n");
