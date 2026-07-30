import { performance } from "node:perf_hooks";
import { createUrlFilter, createUrlScanner } from "../dist/index.js";

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;

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
  console.log("\nurl benchmark");
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
const allowlistFilter = createUrlFilter({ allowedDomains: ALLOWED_DOMAINS });
const allowlistScanner = createUrlScanner({ allowedDomains: ALLOWED_DOMAINS });
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
  bench("censor short clean", () => filter.censor(SHORT_CLEAN)),
  bench("censor long clean", () => filter.censor(LONG_CLEAN)),
  bench("censor direct URL", () => filter.censor(DIRECT_URL)),
  bench("censor bare domain", () => filter.censor(BARE_DOMAIN)),
  bench("censor obfuscated URL", () => filter.censor(OBFUSCATED_URL)),
  bench("censor allowlist hit", () => allowlistFilter.censor(ALLOWLISTED_URL)),
  bench("censor allowlist miss", () => allowlistFilter.censor(ALLOWLIST_MISS)),
  bench("censor late-match URL", () => filter.censor(LATE_MATCH)),
]);

console.log("\nbenchmark complete\n");
