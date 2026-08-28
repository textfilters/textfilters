import { performance } from "node:perf_hooks";
import { createEmailFilter } from "../dist/index.js";

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
const ALLOWED_EMAIL = "Contact support@example.com for details";
const ALLOWED_DOMAIN = "Contact user@internal.example for details";
const ALLOWLIST_MISS = "Contact user@blocked.example for details";

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
const directOnlyFilter = createEmailFilter({ matchObfuscated: false });
const allowlistFilter = createEmailFilter({
  allowedEmails: ["support@example.com"],
  allowedDomains: ["internal.example"],
});

printResults([
  bench("createEmailFilter()", () => createEmailFilter(), SETUP_ITERATIONS),
  bench(
    "createEmailFilter() with allowlists",
    () =>
      createEmailFilter({
        allowedEmails: ["support@example.com"],
        allowedDomains: ["internal.example"],
      }),
    SETUP_ITERATIONS,
  ),
  bench("check short clean", () => filter.check(SHORT_CLEAN)),
  bench("check long clean", () => filter.check(LONG_CLEAN)),
  bench("check no-dot @ text", () => filter.check(NO_DOT_AT)),
  bench("check direct email", () => filter.check(DIRECT_EMAIL)),
  bench("check obfuscated email", () => filter.check(OBFUSCATED_EMAIL)),
  bench("check late-match email", () => filter.check(LATE_MATCH)),
  bench("check direct-only direct email", () =>
    directOnlyFilter.check(DIRECT_EMAIL),
  ),
  bench("check direct-only obfuscated email", () =>
    directOnlyFilter.check(OBFUSCATED_EMAIL),
  ),
  bench("check allowed email", () => allowlistFilter.check(ALLOWED_EMAIL)),
  bench("check allowed domain", () => allowlistFilter.check(ALLOWED_DOMAIN)),
  bench("check allowlist miss", () => allowlistFilter.check(ALLOWLIST_MISS)),
  bench("find direct email", () => filter.find(DIRECT_EMAIL)),
  bench("find obfuscated email", () => filter.find(OBFUSCATED_EMAIL)),
  bench("find late-match email", () => filter.find(LATE_MATCH)),
  bench("censor short clean", () => filter.censor(SHORT_CLEAN)),
  bench("censor long clean", () => filter.censor(LONG_CLEAN)),
  bench("censor no-dot @ text", () => filter.censor(NO_DOT_AT)),
  bench("censor direct email", () => filter.censor(DIRECT_EMAIL)),
  bench("censor obfuscated email", () => filter.censor(OBFUSCATED_EMAIL)),
  bench("censor late-match email", () => filter.censor(LATE_MATCH)),
  bench("censor custom mask", () => filter.censor(DIRECT_EMAIL, "#")),
  bench("process direct email", () => filter.process(DIRECT_EMAIL)),
  bench("process obfuscated email", () => filter.process(OBFUSCATED_EMAIL)),
  bench("process late-match email", () => filter.process(LATE_MATCH)),
]);

console.log("\nbenchmark complete\n");
