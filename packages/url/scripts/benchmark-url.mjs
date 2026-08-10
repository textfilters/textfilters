import { performance } from "node:perf_hooks";
import { createUrlFilter, createUrlScanner } from "../dist/index.js";

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;
const SAMPLES = 5;

const SHORT_CLEAN = "Hello world";
const LONG_CLEAN = "The quick brown fox jumps over the lazy dog. ".repeat(50);
const DIRECT_URL = "Visit https://example.com/path?q=1 for details";
const BARE_DOMAIN = "Visit example.com/path for details";
const OBFUSCATED_URL = "Visit hxxp[:]//example[.]com for details";
const ALLOWLISTED_URL = "Visit https://trusted.example/path for details";
const ALLOWLIST_MISS = "Visit https://blocked.example/path for details";
const ALLOWED_DOMAINS = ["trusted.example"];
const LATE_MATCH =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(40) +
  "Check https://spam.example.com/promo now!";
const STRICT_SPACED_DOT = "Review evil. Com now. ".repeat(50);
const CANDIDATE_SHAPED_MISS =
  "Review placeholder.invalid before release. ".repeat(50);
const UNICODE_LATE_MATCH =
  "Café résumé without a link. ".repeat(40) + "example.рф";

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

function bench(label, fn, iterations = ITERATIONS) {
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  const samples = [];
  for (let sample = 0; sample < SAMPLES; sample++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    samples.push(performance.now() - start);
  }
  const totalMs = median(samples);
  const avgMs = totalMs / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  return { label, iterations, totalMs, avgMs, opsPerSec };
}

function printResults(results) {
  console.log(`\nurl benchmark (median of ${SAMPLES} timed samples)`);
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

const filter = createUrlFilter();
const scanner = createUrlScanner();
const strictScanner = createUrlScanner({ ambiguousSpacedDots: "block" });
const allowlistFilter = createUrlFilter({ allowedDomains: ALLOWED_DOMAINS });
const allowlistScanner = createUrlScanner({ allowedDomains: ALLOWED_DOMAINS });
const strictFilter = createUrlFilter({ ambiguousSpacedDots: "block" });
const input = (text) => ({ text, codePoints: Array.from(text) });
const hintedInput = (text) => ({
  text,
  codePoints: Array.from(text),
  hints: {
    hasNonAscii: /[^\x00-\x7f]/u.test(text),
    hasDot: text.includes("."),
    hasSlash: text.includes("/"),
    hasColon: text.includes(":"),
  },
});
// Prepare scanner inputs outside timed loops so steady-state rows measure the
// scanner rather than repeated input construction.
const scannerInputs = {
  shortClean: input(SHORT_CLEAN),
  longClean: input(LONG_CLEAN),
  directUrl: input(DIRECT_URL),
  bareDomain: input(BARE_DOMAIN),
  allowlistHit: input(ALLOWLISTED_URL),
  allowlistMiss: input(ALLOWLIST_MISS),
  lateMatch: input(LATE_MATCH),
  strictSpacedDot: input(STRICT_SPACED_DOT),
  candidateShapedMiss: input(CANDIDATE_SHAPED_MISS),
  unicodeLateMatch: input(UNICODE_LATE_MATCH),
};
const hintedScannerInputs = {
  shortClean: hintedInput(SHORT_CLEAN),
  longClean: hintedInput(LONG_CLEAN),
};

printResults([
  bench("createUrlFilter()", () => createUrlFilter(), SETUP_ITERATIONS),
  bench("createUrlScanner()", () => createUrlScanner(), SETUP_ITERATIONS),
  bench(
    "createUrlFilter() with allowlist",
    () => createUrlFilter({ allowedDomains: ALLOWED_DOMAINS }),
    SETUP_ITERATIONS,
  ),
  bench(
    "createUrlScanner() with allowlist",
    () => createUrlScanner({ allowedDomains: ALLOWED_DOMAINS }),
    SETUP_ITERATIONS,
  ),
  bench("check short clean", () => scanner.check(scannerInputs.shortClean)),
  bench("check hinted short clean", () =>
    scanner.check(hintedScannerInputs.shortClean),
  ),
  bench("check long clean", () => scanner.check(scannerInputs.longClean)),
  bench("check hinted long clean", () =>
    scanner.check(hintedScannerInputs.longClean),
  ),
  bench("check direct URL", () => scanner.check(scannerInputs.directUrl)),
  bench("check bare domain", () => scanner.check(scannerInputs.bareDomain)),
  bench("check allowlist hit", () =>
    allowlistScanner.check(scannerInputs.allowlistHit),
  ),
  bench("check allowlist miss", () =>
    allowlistScanner.check(scannerInputs.allowlistMiss),
  ),
  bench("check late-match URL", () => scanner.check(scannerInputs.lateMatch)),
  bench("check strict spaced-dot prose", () =>
    strictScanner.check(scannerInputs.strictSpacedDot),
  ),
  bench("check candidate-shaped miss", () =>
    scanner.check(scannerInputs.candidateShapedMiss),
  ),
  bench("check Unicode late match", () =>
    scanner.check(scannerInputs.unicodeLateMatch),
  ),
  bench("censor short clean", () => filter.censor(SHORT_CLEAN)),
  bench("censor long clean", () => filter.censor(LONG_CLEAN)),
  bench("censor direct URL", () => filter.censor(DIRECT_URL)),
  bench("censor bare domain", () => filter.censor(BARE_DOMAIN)),
  bench("censor obfuscated URL", () => filter.censor(OBFUSCATED_URL)),
  bench("censor allowlist hit", () => allowlistFilter.censor(ALLOWLISTED_URL)),
  bench("censor allowlist miss", () => allowlistFilter.censor(ALLOWLIST_MISS)),
  bench("censor late-match URL", () => filter.censor(LATE_MATCH)),
  bench("censor strict spaced-dot prose", () =>
    strictFilter.censor(STRICT_SPACED_DOT),
  ),
  bench("censor candidate-shaped miss", () =>
    filter.censor(CANDIDATE_SHAPED_MISS),
  ),
  bench("censor Unicode late match", () => filter.censor(UNICODE_LATE_MATCH)),
]);

console.log("\nbenchmark complete\n");
