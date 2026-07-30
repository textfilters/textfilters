import { performance } from "node:perf_hooks";
import { createProfanityFilter } from "../dist/index.js";

const DEFAULT_MATCH = "\u0431\u043b\u044f\u0434\u044c";
const UNIQUE_CLEAN = Array.from(
  { length: 300 },
  (_, index) => `ordinary${index}`,
).join(" ");
const REPEATED_CLEAN = Array.from({ length: 300 }, () => "ordinary").join(" ");
const REPEATED_MATCH = Array.from({ length: 300 }, () => DEFAULT_MATCH).join(
  " ",
);
const STRICT_EARLY_MATCH = `${DEFAULT_MATCH} ${UNIQUE_CLEAN}`;
const STRICT_LATE_MATCH = `${UNIQUE_CLEAN} ${DEFAULT_MATCH}`;
const REPEATED_INSTRUMENTED_MATCH = Array.from(
  { length: 300 },
  () => "blocked",
).join(" ");

const filter = createProfanityFilter();
const instrumentedFilter = createProfanityFilter(
  ["ordinarypattern", "blocked"],
  [],
);

const benchmark = (label, fn, iterations) => {
  for (let index = 0; index < Math.min(100, iterations); index++) fn();

  const start = performance.now();
  for (let index = 0; index < iterations; index++) fn();
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;

  return {
    label,
    iterations,
    avgMs,
    opsPerSec: Math.round(1_000 / avgMs),
  };
};

const countLookupWork = (fn) => {
  const NativeSet = globalThis.Set;
  const nativeSort = Array.prototype.sort;
  let setConstructions = 0;
  let arraySorts = 0;

  class CountingSet extends NativeSet {
    constructor(values) {
      super(values);
      setConstructions++;
    }
  }

  globalThis.Set = CountingSet;
  Array.prototype.sort = function (...args) {
    arraySorts++;
    return nativeSort.apply(this, args);
  };

  try {
    fn();
  } finally {
    globalThis.Set = NativeSet;
    Array.prototype.sort = nativeSort;
  }

  return { setConstructions, arraySorts };
};

const countIndexedPatternEvaluations = (fn) => {
  const nativeTest = RegExp.prototype.test;
  let evaluations = 0;

  RegExp.prototype.test = function (...args) {
    if (this.source.startsWith("^(?:") && this.source.endsWith(")$")) {
      evaluations++;
    }
    return nativeTest.apply(this, args);
  };

  try {
    fn();
  } finally {
    RegExp.prototype.test = nativeTest;
  }

  return evaluations;
};

const timingCases = [
  {
    label: "check unique clean tokens",
    fn: () => filter.check(UNIQUE_CLEAN),
    iterations: 200,
  },
  {
    label: "check repeated clean tokens",
    fn: () => filter.check(REPEATED_CLEAN),
    iterations: 200,
  },
  {
    label: "analyze repeated matches",
    fn: () => filter.analyze(REPEATED_MATCH),
    iterations: 200,
  },
  {
    label: "check strict early match",
    fn: () => filter.check(STRICT_EARLY_MATCH),
    iterations: 1_000,
  },
  {
    label: "check strict late match",
    fn: () => filter.check(STRICT_LATE_MATCH),
    iterations: 200,
  },
];

const instrumentationCases = [
  {
    label: "unique clean indexed evaluations",
    fn: () => instrumentedFilter.check(UNIQUE_CLEAN),
  },
  {
    label: "repeated clean indexed evaluations",
    fn: () => instrumentedFilter.check(REPEATED_CLEAN),
  },
  {
    label: "repeated match indexed evaluations",
    fn: () => instrumentedFilter.analyze(REPEATED_INSTRUMENTED_MATCH),
  },
];

const results = [
  benchmark("createProfanityFilter()", () => createProfanityFilter(), 100),
  ...timingCases.map(({ label, fn, iterations }) =>
    benchmark(label, fn, iterations),
  ),
];

console.log("\nstrict token lookup benchmark");
for (const result of results) {
  console.log(
    `${result.label}: ${result.avgMs.toFixed(4)} avg ms, ${result.opsPerSec} ops/sec`,
  );
}

console.log("\nstrict token lookup instrumentation");
for (const { label, fn } of timingCases) {
  const counts = countLookupWork(fn);
  console.log(
    `${label}: ${counts.setConstructions} Set constructions/call, ${counts.arraySorts} Array sorts/call`,
  );
}

console.log("\nstrict token cache instrumentation");
for (const { label, fn } of instrumentationCases) {
  console.log(`${label}: ${countIndexedPatternEvaluations(fn)} per call`);
}

console.log("\nstrict token lookup benchmark complete\n");
