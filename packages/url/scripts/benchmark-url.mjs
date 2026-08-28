import { performance } from "node:perf_hooks";
import { createUrlFilter } from "../dist/index.js";

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
const SPACED_DOT_PROSE = "Review evil. Com now. ".repeat(50);
const CANDIDATE_SHAPED_MISS =
  "Review placeholder.invalid before release. ".repeat(50);
const UNICODE_LATE_MATCH =
  "Café résumé without a link. ".repeat(40) + "example.рф";
const MALFORMED_AUTHORITY = `http://[${"a[".repeat(2_000)}:a]`;
const TRAILING_PATH_CLOSERS = `https://example.com/${")".repeat(4_000)}`;
const CUSTOM_TLDS = [
  "com",
  ...Array.from({ length: 1_500 }, (_, index) => `custom${index}`),
];
const CUSTOM_TLD_URL = "Visit example.custom1499/path for details";

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
    `${"label".padEnd(52)} ${"iter".padStart(7)} ${"total ms".padStart(10)} ${"avg ms".padStart(10)} ${"ops/sec".padStart(10)}`,
  );
  console.log("-".repeat(93));
  for (const result of results) {
    console.log(
      `${result.label.padEnd(52)} ${String(result.iterations).padStart(7)} ${result.totalMs.toFixed(2).padStart(10)} ${result.avgMs.toFixed(4).padStart(10)} ${String(result.opsPerSec).padStart(10)}`,
    );
  }
}

const filter = createUrlFilter();
const allowlistFilter = createUrlFilter({ allowedDomains: ALLOWED_DOMAINS });
const customTldFilter = createUrlFilter({ tlds: CUSTOM_TLDS });

printResults([
  bench("createUrlFilter()", () => createUrlFilter(), SETUP_ITERATIONS),
  bench(
    "createUrlFilter() with allowlist",
    () => createUrlFilter({ allowedDomains: ALLOWED_DOMAINS }),
    SETUP_ITERATIONS,
  ),
  bench(
    "createUrlFilter() with large custom TLD snapshot",
    () => createUrlFilter({ tlds: CUSTOM_TLDS }),
    SETUP_ITERATIONS,
  ),
  bench("check short clean", () => filter.check(SHORT_CLEAN)),
  bench("check long clean", () => filter.check(LONG_CLEAN)),
  bench("check direct URL", () => filter.check(DIRECT_URL)),
  bench("check bare domain", () => filter.check(BARE_DOMAIN)),
  bench("check obfuscated URL", () => filter.check(OBFUSCATED_URL)),
  bench("check allowlist hit", () => allowlistFilter.check(ALLOWLISTED_URL)),
  bench("check allowlist miss", () => allowlistFilter.check(ALLOWLIST_MISS)),
  bench("check late-match URL", () => filter.check(LATE_MATCH)),
  bench("check conservative spaced-dot prose", () =>
    filter.check(SPACED_DOT_PROSE),
  ),
  bench("check candidate-shaped miss", () =>
    filter.check(CANDIDATE_SHAPED_MISS),
  ),
  bench("check Unicode late match", () => filter.check(UNICODE_LATE_MATCH)),
  bench(
    "check malformed explicit authority",
    () => filter.check(MALFORMED_AUTHORITY),
    100,
  ),
  bench(
    "check trailing path closers",
    () => filter.check(TRAILING_PATH_CLOSERS),
    100,
  ),
  bench("check large custom TLD snapshot", () =>
    customTldFilter.check(CUSTOM_TLD_URL),
  ),
  bench("find direct URL", () => filter.find(DIRECT_URL)),
  bench("find bare domain", () => filter.find(BARE_DOMAIN)),
  bench("find obfuscated URL", () => filter.find(OBFUSCATED_URL)),
  bench("find late-match URL", () => filter.find(LATE_MATCH)),
  bench("find Unicode late match", () => filter.find(UNICODE_LATE_MATCH)),
  bench("censor short clean", () => filter.censor(SHORT_CLEAN)),
  bench("censor long clean", () => filter.censor(LONG_CLEAN)),
  bench("censor direct URL", () => filter.censor(DIRECT_URL)),
  bench("censor bare domain", () => filter.censor(BARE_DOMAIN)),
  bench("censor obfuscated URL", () => filter.censor(OBFUSCATED_URL)),
  bench("censor allowlist hit", () => allowlistFilter.censor(ALLOWLISTED_URL)),
  bench("censor allowlist miss", () => allowlistFilter.censor(ALLOWLIST_MISS)),
  bench("censor late-match URL", () => filter.censor(LATE_MATCH)),
  bench("censor conservative spaced-dot prose", () =>
    filter.censor(SPACED_DOT_PROSE),
  ),
  bench("censor candidate-shaped miss", () =>
    filter.censor(CANDIDATE_SHAPED_MISS),
  ),
  bench("censor Unicode late match", () => filter.censor(UNICODE_LATE_MATCH)),
  bench("censor custom mask", () => filter.censor(DIRECT_URL, "#")),
  bench("process direct URL", () => filter.process(DIRECT_URL)),
  bench("process late-match URL", () => filter.process(LATE_MATCH)),
  bench("process large custom TLD snapshot", () =>
    customTldFilter.process(CUSTOM_TLD_URL),
  ),
]);

console.log("\nbenchmark complete\n");
