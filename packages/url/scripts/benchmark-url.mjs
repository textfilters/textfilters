import { performance } from "node:perf_hooks";
import {
  checkUrlRanges,
  createUrlFilter,
  createUrlScanner,
  scanUrlRangeMatches,
  scanUrlRanges,
} from "../dist/index.js";

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
const MALFORMED_AUTHORITY = `http://[${"a[".repeat(2_000)}:a]`;
const TRAILING_PATH_CLOSERS = `https://example.com/${")".repeat(4_000)}`;
const CUSTOM_TLDS = new Set([
  "com",
  ...Array.from({ length: 1_500 }, (_, index) => `custom${index}`),
]);
const CUSTOM_TLD_TARGETS = new Set(CUSTOM_TLDS);

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
  longClean: input(LONG_CLEAN),
  directUrl: input(DIRECT_URL),
  bareDomain: input(BARE_DOMAIN),
  malformedAuthority: input(MALFORMED_AUTHORITY),
  trailingPathClosers: input(TRAILING_PATH_CLOSERS),
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
  // Keep input construction in the original row names so results remain
  // comparable with earlier revisions. Prepared-input rows below isolate the
  // steady-state allocation-aware scanner contract.
  bench("check short clean", () => scanner.check(input(SHORT_CLEAN))),
  bench("check hinted short clean", () =>
    scanner.check(hintedInput(SHORT_CLEAN)),
  ),
  bench("check long clean", () => scanner.check(input(LONG_CLEAN))),
  bench("check hinted long clean", () =>
    scanner.check(hintedInput(LONG_CLEAN)),
  ),
  bench("check direct URL", () => scanner.check(input(DIRECT_URL))),
  bench("check bare domain", () => scanner.check(input(BARE_DOMAIN))),
  bench("check allowlist hit", () =>
    allowlistScanner.check(input(ALLOWLISTED_URL)),
  ),
  bench("check allowlist miss", () =>
    allowlistScanner.check(input(ALLOWLIST_MISS)),
  ),
  bench("check late-match URL", () => scanner.check(input(LATE_MATCH))),
  bench("check strict spaced-dot prose", () =>
    strictScanner.check(input(STRICT_SPACED_DOT)),
  ),
  bench("check candidate-shaped miss", () =>
    scanner.check(input(CANDIDATE_SHAPED_MISS)),
  ),
  bench("check Unicode late match", () =>
    scanner.check(input(UNICODE_LATE_MATCH)),
  ),
  bench("prepare long scanner input", () => input(LONG_CLEAN)),
  bench("check prepared long clean", () =>
    scanner.check(scannerInputs.longClean),
  ),
  bench("scan prepared direct URL", () =>
    scanner.scan(scannerInputs.directUrl),
  ),
  bench("scan sink prepared direct URL", () =>
    scanner.scan(scannerInputs.directUrl, () => true),
  ),
  bench("checkUrlRanges custom TLD snapshot", () =>
    checkUrlRanges(scannerInputs.bareDomain, CUSTOM_TLDS, CUSTOM_TLD_TARGETS),
  ),
  bench("scanUrlRanges custom TLD snapshot", () =>
    scanUrlRanges(BARE_DOMAIN, CUSTOM_TLDS, CUSTOM_TLD_TARGETS),
  ),
  bench("scanUrlRangeMatches custom snapshot", () =>
    scanUrlRangeMatches(
      scannerInputs.bareDomain,
      () => true,
      CUSTOM_TLDS,
      CUSTOM_TLD_TARGETS,
    ),
  ),
  bench(
    "check malformed explicit authority",
    () => scanner.check(scannerInputs.malformedAuthority),
    100,
  ),
  bench(
    "check trailing path closers",
    () => scanner.check(scannerInputs.trailingPathClosers),
    100,
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
