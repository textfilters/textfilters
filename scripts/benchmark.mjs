/**
 * Public API benchmark suite.
 *
 * Run with: npm run benchmark -- [suite...]
 * Compare medians from identical runs on the same machine and Node.js version.
 */

import { performance } from "node:perf_hooks";
import { combineFilters, createModerationPipeline } from "@textfilters/core";
import { createEmailFilter } from "@textfilters/email";
import { filter as phone } from "@textfilters/phone";
import { createProfanityFilter } from "@textfilters/profanity";
import englishDictionary from "@textfilters/profanity-en";
import russianDictionary from "@textfilters/profanity-ru";
import { createSpamGuard } from "@textfilters/spam";
import { createUrlFilter } from "@textfilters/url";

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;
const SUITES = [
  "core",
  "url",
  "email",
  "phone",
  "profanity",
  "spam",
  "combined",
];
const requestedSuites = new Set(process.argv.slice(2));

if (requestedSuites.has("--help") || requestedSuites.has("-h")) {
  console.log("Usage: npm run benchmark -- [suite...]");
  console.log(`Suites: ${SUITES.join(", ")}`);
  process.exit(0);
}

for (const suite of requestedSuites) {
  if (!SUITES.includes(suite)) {
    console.error(`Unknown benchmark suite: ${suite}`);
    console.error(`Available suites: ${SUITES.join(", ")}`);
    process.exit(1);
  }
}

function shouldRunSuite(suite) {
  return requestedSuites.size === 0 || requestedSuites.has(suite);
}

function bench(label, fn, iterations = ITERATIONS) {
  for (let index = 0; index < Math.min(100, iterations); index += 1) fn();

  const start = performance.now();
  for (let index = 0; index < iterations; index += 1) fn();
  const totalMs = performance.now() - start;
  const avgMs = totalMs / iterations;

  return {
    label,
    iterations,
    totalMs,
    avgMs,
    opsPerSec: Math.round(1_000 / avgMs),
  };
}

function printResults(suiteName, results) {
  console.log(
    `\n── ${suiteName} ${"─".repeat(Math.max(0, 60 - suiteName.length))}`,
  );
  console.log(
    `${"label".padEnd(52)} ${"iter".padStart(7)} ${"total ms".padStart(10)} ${"avg ms".padStart(10)} ${"ops/sec".padStart(10)}`,
  );
  console.log("─".repeat(93));
  for (const result of results) {
    console.log(
      `${result.label.padEnd(52)} ${String(result.iterations).padStart(7)} ${result.totalMs.toFixed(2).padStart(10)} ${result.avgMs.toFixed(4).padStart(10)} ${String(result.opsPerSec).padStart(10)}`,
    );
  }
}

function runSuite(suite, suiteName, createResults) {
  if (shouldRunSuite(suite)) printResults(suiteName, createResults());
}

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

const createFullProfanityFilter = () =>
  createProfanityFilter(russianDictionary, englishDictionary);

function createCombinedFilter() {
  return combineFilters(
    createEmailFilter(),
    createUrlFilter(),
    phone,
    createFullProfanityFilter(),
  );
}

function createFilterResults({
  name,
  factoryLabel,
  createFilter,
  shortMatch,
  longMatch,
}) {
  const filter = createFilter();

  return [
    bench(`${name} · ${factoryLabel}`, createFilter, SETUP_ITERATIONS),
    bench(`${name} · check · short clean`, () => filter.check(SHORT_CLEAN)),
    bench(`${name} · check · long clean`, () => filter.check(LONG_CLEAN)),
    bench(`${name} · check · short match`, () => filter.check(shortMatch)),
    bench(`${name} · check · long match late`, () => filter.check(longMatch)),
    bench(`${name} · find · short match`, () => filter.find(shortMatch)),
    bench(`${name} · find · long match late`, () => filter.find(longMatch)),
    bench(`${name} · censor · short clean`, () => filter.censor(SHORT_CLEAN)),
    bench(`${name} · censor · long clean`, () => filter.censor(LONG_CLEAN)),
    bench(`${name} · censor · short match`, () => filter.censor(shortMatch)),
    bench(`${name} · censor · long match late`, () => filter.censor(longMatch)),
    bench(`${name} · censor · custom mask · short match`, () =>
      filter.censor(shortMatch, "#"),
    ),
    bench(`${name} · process · short match`, () => filter.process(shortMatch)),
    bench(`${name} · process · long match late`, () =>
      filter.process(longMatch),
    ),
  ];
}

runSuite("core", "core · composition and moderation", () => {
  const combined = combineFilters(createEmailFilter(), createUrlFilter());
  const allowed = createModerationPipeline({
    guards: [{ name: "allow", check: () => ({ allowed: true }) }],
    filters: [combined],
  });
  const blocked = createModerationPipeline({
    guards: [
      {
        name: "block",
        check: () => ({ allowed: false, reason: "blocked" }),
      },
    ],
    filters: [combined],
  });
  const message = { actorKey: "benchmark", text: SHORT_EMAIL };

  return [
    bench(
      "combineFilters · create two-filter composition",
      () => combineFilters(createEmailFilter(), createUrlFilter()),
      SETUP_ITERATIONS,
    ),
    bench(
      "moderation · create allowed pipeline",
      () =>
        createModerationPipeline({
          guards: [{ name: "allow", check: () => ({ allowed: true }) }],
          filters: [combined],
        }),
      SETUP_ITERATIONS,
    ),
    bench("combined · check · long clean", () => combined.check(LONG_CLEAN)),
    bench("combined · find · long match late", () =>
      combined.find(LONG_URL_LATE),
    ),
    bench("combined · censor · long match late", () =>
      combined.censor(LONG_URL_LATE),
    ),
    bench("combined · process · long match late", () =>
      combined.process(LONG_URL_LATE),
    ),
    bench("moderation · allowed path", () => allowed.process(message)),
    bench("moderation · early blocked path", () => blocked.process(message)),
  ];
});

for (const suite of [
  {
    name: "url",
    factoryLabel: "createUrlFilter()",
    createFilter: createUrlFilter,
    shortMatch: SHORT_URL,
    longMatch: LONG_URL_LATE,
  },
  {
    name: "email",
    factoryLabel: "createEmailFilter()",
    createFilter: createEmailFilter,
    shortMatch: SHORT_EMAIL,
    longMatch: LONG_EMAIL_LATE,
  },
  {
    name: "phone",
    factoryLabel: "shared filter access",
    createFilter: () => phone,
    shortMatch: SHORT_PHONE,
    longMatch: LONG_PHONE_LATE,
  },
]) {
  runSuite(suite.name, suite.name, () => createFilterResults(suite));
}

runSuite("profanity", "profanity", () => {
  const createRussianFilter = () => createProfanityFilter(russianDictionary);
  const createEnglishFilter = () => createProfanityFilter(englishDictionary);
  const filter = createFullProfanityFilter();

  return [
    bench(
      "profanity · create full RU filter",
      createRussianFilter,
      SETUP_ITERATIONS,
    ),
    bench(
      "profanity · create full EN filter",
      createEnglishFilter,
      SETUP_ITERATIONS,
    ),
    bench(
      "profanity · create full RU+EN filter",
      createFullProfanityFilter,
      SETUP_ITERATIONS,
    ),
    bench("profanity · check · short clean", () => filter.check(SHORT_PROFANE)),
    bench("profanity · check · short match", () =>
      filter.check(SHORT_PROFANE_MATCH),
    ),
    bench("profanity · check · long clean", () =>
      filter.check(LONG_PROFANE_CLEAN),
    ),
    bench("profanity · check · long match late", () =>
      filter.check(LONG_PROFANE_MATCH_LATE),
    ),
    bench("profanity · find · short match", () =>
      filter.find(SHORT_PROFANE_MATCH),
    ),
    bench("profanity · find · long match late", () =>
      filter.find(LONG_PROFANE_MATCH_LATE),
    ),
    bench("profanity · censor · short clean", () =>
      filter.censor(SHORT_PROFANE),
    ),
    bench("profanity · censor · short match", () =>
      filter.censor(SHORT_PROFANE_MATCH),
    ),
    bench("profanity · censor · long clean", () =>
      filter.censor(LONG_PROFANE_CLEAN),
    ),
    bench("profanity · censor · long match late", () =>
      filter.censor(LONG_PROFANE_MATCH_LATE),
    ),
    bench("profanity · process · short match", () =>
      filter.process(SHORT_PROFANE_MATCH),
    ),
    bench("profanity · process · long match late", () =>
      filter.process(LONG_PROFANE_MATCH_LATE),
    ),
    bench("profanity · check · phrase", () => filter.check("еб твою мать")),
    bench("profanity · check · obfuscated", () =>
      filter.check("х-у-й and f-υ-c-k"),
    ),
    bench("profanity · check · exact allow", () =>
      filter.check("сука породы лабрадор"),
    ),
  ];
});

runSuite("spam", "spam", () => {
  let clock = 1_000_000;
  let messageId = 0;
  const nextTime = (gap = 2_000) => (clock += gap);
  const allowedGuard = createSpamGuard({ minIntervalMs: 0 });

  return [
    bench(
      "spam · createSpamGuard()",
      () => createSpamGuard(),
      SETUP_ITERATIONS,
    ),
    bench("spam · check · allowed · short", () =>
      allowedGuard.check({
        actorKey: "u1",
        text: `allowed ${messageId++}`,
        nowMs: nextTime(),
      }),
    ),
    bench("spam · check · tooFast block", () => {
      const guard = createSpamGuard({ minIntervalMs: 5_000 });
      const base = nextTime(10_000);
      guard.check({ actorKey: "u1", text: "first", nowMs: base });
      return guard.check({ actorKey: "u1", text: "second", nowMs: base + 100 });
    }),
    bench("spam · check · duplicate block", () => {
      const guard = createSpamGuard({ duplicateWindowMs: 60_000 });
      const base = nextTime(10_000);
      guard.check({ actorKey: "u1", text: SHORT_CLEAN, nowMs: base });
      return guard.check({
        actorKey: "u1",
        text: SHORT_CLEAN,
        nowMs: base + 1_000,
      });
    }),
    bench("spam · check · burst block", () => {
      const guard = createSpamGuard({
        minIntervalMs: 0,
        burstMaxMessages: 3,
        burstWindowMs: 10_000,
      });
      const base = nextTime(10_000);
      guard.check({ actorKey: "u1", text: "a", nowMs: base });
      guard.check({ actorKey: "u1", text: "b", nowMs: base + 100 });
      guard.check({ actorKey: "u1", text: "c", nowMs: base + 200 });
      return guard.check({ actorKey: "u1", text: "d", nowMs: base + 300 });
    }),
    bench(
      "spam · check · many messages · same actor",
      () => {
        const guard = createSpamGuard({
          minIntervalMs: 0,
          duplicateWindowMs: 1_000,
          burstMaxMessages: 100,
          burstWindowMs: 1_000,
        });
        for (let index = 0; index < 50; index += 1) {
          guard.check({
            actorKey: "u1",
            text: `msg ${index}`,
            nowMs: nextTime(100),
          });
        }
      },
      500,
    ),
    bench(
      "spam · check · many actors · maxActors pruning",
      () => {
        const guard = createSpamGuard({
          maxActors: 10,
          minIntervalMs: 0,
          burstMaxMessages: 100,
        });
        const base = nextTime(10_000);
        for (let index = 0; index < 50; index += 1) {
          guard.check({
            actorKey: `u${index}`,
            text: `msg ${index}`,
            nowMs: base + index,
          });
        }
      },
      500,
    ),
  ];
});

runSuite("combined", "pipeline · url + email + phone + profanity", () => {
  const combined = createCombinedFilter();
  const scenarios = [
    ["short clean", "Hello, this message is clean."],
    ["long clean", LONG_CLEAN],
    [
      "short all-match",
      "Пиши на evil@spam.ru или https://spam.ru, тел. +7 (999) 000-00-00, и не будь мудаком",
    ],
    [
      "long match late",
      "Обычный текст без нарушений. ".repeat(50) +
        "Пиши на evil@spam.ru или https://spam.ru тел +7 (999) 000-00-00 блять",
    ],
    [
      "mixed overlaps",
      "Contact admin@example.com, https://example.com/support, +1 555 123 4567, хуй",
    ],
    ["cyrillic clean", "Привет, как дела? Всё хорошо."],
    ["obfuscated", "Looks ordinary, but б л я т ь appears between safe words."],
  ];
  const results = [
    bench("combined filter · create", createCombinedFilter, SETUP_ITERATIONS),
  ];

  for (const [label, input] of scenarios) {
    results.push(
      bench(`combined · check · ${label}`, () => combined.check(input)),
      bench(`combined · find · ${label}`, () => combined.find(input)),
      bench(`combined · censor · ${label}`, () => combined.censor(input)),
      bench(`combined · process · ${label}`, () => combined.process(input)),
    );
  }

  const overlap = combineFilters(createEmailFilter(), createUrlFilter());
  results.push(
    bench("combined · process · overlapping filter matches", () =>
      overlap.process("Contact admin@example.com or https://example.com"),
    ),
  );

  const allowed = createModerationPipeline({
    guards: [{ name: "allow", check: () => ({ allowed: true }) }],
    filters: [combined],
  });
  const blocked = createModerationPipeline({
    guards: [
      {
        name: "block",
        check: () => ({ allowed: false, reason: "blocked" }),
      },
    ],
    filters: [combined],
  });
  const moderationInput = {
    actorKey: "benchmark",
    text: scenarios[2][1],
  };
  results.push(
    bench("moderation · allowed · all-match", () =>
      allowed.process(moderationInput),
    ),
    bench("moderation · blocked early · all-match", () =>
      blocked.process(moderationInput),
    ),
  );

  return results;
});

console.log("\n✓ benchmark complete\n");
