/**
 * @textfilters benchmark suite
 *
 * Run with: npm run benchmark
 *
 * Prints iterations / totalMs / avgMs / opsPerSec for each case.
 * Absolute numbers are machine-dependent; use them for before/after
 * comparisons on the same hardware.
 */

import { performance } from "node:perf_hooks";
import { createTextPipeline } from "@textfilters/core";
import { createUrlFilter } from "@textfilters/url";
import { createEmailFilter } from "@textfilters/email";
import { createPhoneFilter } from "@textfilters/phone";
import {
  compileProfanityDictionary,
  createProfanityFilterFromCompiledDictionary,
  createProfanityFilterFromDictionary,
  russianProfanityDictionary,
} from "@textfilters/profanity";
import { createSpamFilter } from "@textfilters/spam";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;

function bench(label, fn, iterations = ITERATIONS) {
  for (let i = 0; i < Math.min(100, iterations); i++) fn();

  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const totalMs = performance.now() - start;

  const avgMs = totalMs / iterations;
  const opsPerSec = Math.round(1000 / avgMs);

  return { label, iterations, totalMs, avgMs, opsPerSec };
}

function printResults(suiteName, results) {
  console.log(`\n── ${suiteName} ${"─".repeat(Math.max(0, 60 - suiteName.length))}`);
  console.log(
    `${"label".padEnd(52)} ${"iter".padStart(7)} ${"total ms".padStart(10)} ${"avg ms".padStart(10)} ${"ops/sec".padStart(10)}`,
  );
  console.log("─".repeat(93));
  for (const r of results) {
    console.log(
      `${r.label.padEnd(52)} ${String(r.iterations).padStart(7)} ${r.totalMs.toFixed(2).padStart(10)} ${r.avgMs.toFixed(4).padStart(10)} ${String(r.opsPerSec).padStart(10)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Test inputs
// ---------------------------------------------------------------------------

const SHORT_CLEAN = "Hello world";
const LONG_CLEAN = "The quick brown fox jumps over the lazy dog. ".repeat(50);

const SHORT_URL = "Visit https://example.com for details";
const LONG_URL_LATE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(40) +
  "Check https://spam.example.com/promo now!";

const SHORT_EMAIL = "Contact us at support@example.com";
const LONG_EMAIL_LATE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(40) +
  "Email hidden@deep.example.org for info.";

const SHORT_PHONE = "Call +7 (999) 123-45-67 today";
const LONG_PHONE_LATE =
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(40) +
  "Hotline: +7 (800) 555-35-35";

const SHORT_PROFANE = "это нормальный текст";
const SHORT_PROFANE_MATCH = "какой же ты блять мудак";
const LONG_PROFANE_CLEAN = "Обычный текст без нарушений. ".repeat(60);
const LONG_PROFANE_MATCH_LATE =
  "Обычный текст без нарушений. ".repeat(55) + "вот тебе хуй и пизда";

// ---------------------------------------------------------------------------
// core pipeline
// ---------------------------------------------------------------------------

{
  const urlFilter = createUrlFilter();
  const emailFilter = createEmailFilter();

  const single = createTextPipeline().use(urlFilter);
  const multi = createTextPipeline().use(urlFilter).use(emailFilter);

  const results = [
    bench("pipeline single filter · short clean", () => single.censor(SHORT_CLEAN)),
    bench("pipeline single filter · long clean", () => single.censor(LONG_CLEAN)),
    bench("pipeline single filter · short url match", () => single.censor(SHORT_URL)),
    bench("pipeline single filter · long url match late", () => single.censor(LONG_URL_LATE)),
    bench("pipeline multi filter · short clean", () => multi.censor(SHORT_CLEAN)),
    bench("pipeline multi filter · long clean", () => multi.censor(LONG_CLEAN)),
    bench("pipeline multi filter · short url+email match", () =>
      multi.censor("Hi user@x.com visit https://x.com"),
    ),
    bench("pipeline multi filter · long text match late", () =>
      multi.censor(LONG_URL_LATE),
    ),
  ];

  printResults("core · pipeline", results);
}

// ---------------------------------------------------------------------------
// url
// ---------------------------------------------------------------------------

{
  const f = createUrlFilter();
  const fCustomMask = createUrlFilter({ maskChar: "█" });

  const results = [
    bench("url · createUrlFilter()", () => createUrlFilter(), SETUP_ITERATIONS),
    bench("url · censor · short clean", () => f.censor(SHORT_CLEAN)),
    bench("url · censor · long clean", () => f.censor(LONG_CLEAN)),
    bench("url · censor · short match", () => f.censor(SHORT_URL)),
    bench("url · censor · long match late", () => f.censor(LONG_URL_LATE)),
    bench("url · censor · custom maskChar · short match", () =>
      fCustomMask.censor(SHORT_URL),
    ),
  ];

  printResults("url", results);
}

// ---------------------------------------------------------------------------
// email
// ---------------------------------------------------------------------------

{
  const f = createEmailFilter();
  const fCustomMask = createEmailFilter({ maskChar: "▪" });

  const results = [
    bench("email · createEmailFilter()", () => createEmailFilter(), SETUP_ITERATIONS),
    bench("email · censor · short clean", () => f.censor(SHORT_CLEAN)),
    bench("email · censor · long clean", () => f.censor(LONG_CLEAN)),
    bench("email · censor · short match", () => f.censor(SHORT_EMAIL)),
    bench("email · censor · long match late", () => f.censor(LONG_EMAIL_LATE)),
    bench("email · censor · custom maskChar · short match", () =>
      fCustomMask.censor(SHORT_EMAIL),
    ),
  ];

  printResults("email", results);
}

// ---------------------------------------------------------------------------
// phone
// ---------------------------------------------------------------------------

{
  const f = createPhoneFilter();
  const fCustomMask = createPhoneFilter({ maskChar: "•" });

  const results = [
    bench("phone · createPhoneFilter()", () => createPhoneFilter(), SETUP_ITERATIONS),
    bench("phone · censor · short clean", () => f.censor(SHORT_CLEAN)),
    bench("phone · censor · long clean", () => f.censor(LONG_CLEAN)),
    bench("phone · censor · short match", () => f.censor(SHORT_PHONE)),
    bench("phone · censor · long match late", () => f.censor(LONG_PHONE_LATE)),
    bench("phone · censor · custom maskChar · short match", () =>
      fCustomMask.censor(SHORT_PHONE),
    ),
  ];

  printResults("phone", results);
}

// ---------------------------------------------------------------------------
// profanity
// ---------------------------------------------------------------------------

{
  const compiled = compileProfanityDictionary(russianProfanityDictionary);
  const f = createProfanityFilterFromDictionary(russianProfanityDictionary);
  const fCompiled = createProfanityFilterFromCompiledDictionary(compiled);

  const results = [
    bench("profanity · compileProfanityDictionary()", () =>
      compileProfanityDictionary(russianProfanityDictionary),
      SETUP_ITERATIONS,
    ),
    bench("profanity · create from fresh dictionary", () =>
      createProfanityFilterFromDictionary(russianProfanityDictionary),
      SETUP_ITERATIONS,
    ),
    bench("profanity · create from compiled dictionary", () =>
      createProfanityFilterFromCompiledDictionary(compiled),
      SETUP_ITERATIONS,
    ),
    bench("profanity · check · short clean", () => f.check(SHORT_PROFANE)),
    bench("profanity · check · short match", () => f.check(SHORT_PROFANE_MATCH)),
    bench("profanity · check · long clean", () => f.check(LONG_PROFANE_CLEAN)),
    bench("profanity · check · long match late", () => f.check(LONG_PROFANE_MATCH_LATE)),
    bench("profanity · censor · short clean", () => f.censor(SHORT_PROFANE)),
    bench("profanity · censor · short match", () => f.censor(SHORT_PROFANE_MATCH)),
    bench("profanity · censor · long clean", () => f.censor(LONG_PROFANE_CLEAN)),
    bench("profanity · censor · long match late", () =>
      f.censor(LONG_PROFANE_MATCH_LATE),
    ),
    bench("profanity · analyze · short clean", () => f.analyze(SHORT_PROFANE)),
    bench("profanity · analyze · short match", () => f.analyze(SHORT_PROFANE_MATCH)),
    bench("profanity · analyze · long match late", () =>
      f.analyze(LONG_PROFANE_MATCH_LATE),
    ),
    bench("profanity · compiled reuse · censor · short match", () =>
      fCompiled.censor(SHORT_PROFANE_MATCH),
    ),
  ];

  printResults("profanity", results);
}

// ---------------------------------------------------------------------------
// spam: every case creates its own guard and uses explicit nowMs values
// ---------------------------------------------------------------------------

{
  const f = createSpamFilter();

  let t = 1_000_000;
  const nextT = (gap = 2000) => (t += gap);

  const results = [
    bench("spam · createSpamFilter()", () => createSpamFilter(), SETUP_ITERATIONS),
    bench(
      "spam · check · allowed · short",
      () => {
        const sf = createSpamFilter();
        return sf.check({ actorKey: "u1", text: SHORT_CLEAN, nowMs: nextT() });
      },
      1_000,
    ),
    bench(
      "spam · check · tooFast block",
      () => {
        const sf = createSpamFilter({ minIntervalMs: 5000 });
        const base = nextT(10_000);
        sf.check({ actorKey: "u1", text: "first", nowMs: base });
        return sf.check({ actorKey: "u1", text: "second", nowMs: base + 100 });
      },
      1_000,
    ),
    bench(
      "spam · check · duplicate block",
      () => {
        const sf = createSpamFilter({ duplicateWindowMs: 60_000 });
        const base = nextT(10_000);
        sf.check({ actorKey: "u1", text: SHORT_CLEAN, nowMs: base });
        return sf.check({ actorKey: "u1", text: SHORT_CLEAN, nowMs: base + 1000 });
      },
      1_000,
    ),
    bench(
      "spam · check · burst block",
      () => {
        const sf = createSpamFilter({
          minIntervalMs: 0,
          burstMaxMessages: 3,
          burstWindowMs: 10_000,
        });
        const base = nextT(10_000);
        sf.check({ actorKey: "u1", text: "a", nowMs: base });
        sf.check({ actorKey: "u1", text: "b", nowMs: base + 100 });
        sf.check({ actorKey: "u1", text: "c", nowMs: base + 200 });
        return sf.check({ actorKey: "u1", text: "d", nowMs: base + 300 });
      },
      1_000,
    ),
    bench(
      "spam · check · many messages · same actor",
      () => {
        const sf = createSpamFilter({
          minIntervalMs: 0,
          burstMaxMessages: 100,
          burstWindowMs: 10_000,
        });
        for (let i = 0; i < 50; i++) {
          sf.check({ actorKey: "u1", text: `msg ${i}`, nowMs: nextT(100) });
        }
      },
      500,
    ),
  ];

  printResults("spam", results);
}

// ---------------------------------------------------------------------------
// combined pipeline: url + email + phone + profanity
// ---------------------------------------------------------------------------

{
  const compiled = compileProfanityDictionary(russianProfanityDictionary);
  const pipeline = createTextPipeline()
    .use(createUrlFilter())
    .use(createEmailFilter())
    .use(createPhoneFilter())
    .use(createProfanityFilterFromCompiledDictionary(compiled));

  const COMBINED_CLEAN = "Привет, как дела? Всё хорошо.";
  const COMBINED_MATCH =
    "Пиши на evil@spam.ru или https://spam.ru, тел. +7 (999) 000-00-00, и не будь мудаком";
  const COMBINED_LONG_LATE =
    "Обычный текст без нарушений. ".repeat(50) +
    "Пиши на evil@spam.ru или https://spam.ru тел +7 (999) 000-00-00 блять";

  const results = [
    bench("combined pipeline · short clean", () => pipeline.censor(COMBINED_CLEAN)),
    bench("combined pipeline · long clean", () => pipeline.censor(LONG_CLEAN)),
    bench("combined pipeline · short all-match", () =>
      pipeline.censor(COMBINED_MATCH),
    ),
    bench("combined pipeline · long match late", () =>
      pipeline.censor(COMBINED_LONG_LATE),
    ),
  ];

  printResults("pipeline · url + email + phone + profanity", results);
}

console.log("\n✓ benchmark complete\n");
