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
import * as corePackage from "@textfilters/core";
import { createUrlFilter } from "@textfilters/url";
import * as urlPackage from "@textfilters/url";
import { createEmailFilter } from "@textfilters/email";
import * as emailPackage from "@textfilters/email";
import { createPhoneFilter } from "@textfilters/phone";
import * as phonePackage from "@textfilters/phone";
import {
  compileProfanityDictionary,
  createProfanityFilterFromCompiledDictionary,
  createProfanityFilterFromDictionary,
  russianProfanityDictionary,
} from "@textfilters/profanity";
import * as profanityPackage from "@textfilters/profanity";
import { createSpamFilter } from "@textfilters/spam";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ITERATIONS = 1_000;
const SETUP_ITERATIONS = 100;
const SUITES = ["core", "url", "email", "phone", "profanity", "spam", "combined"];
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

function runSuite(suite, suiteName, createResults) {
  if (!shouldRunSuite(suite)) return;
  printResults(suiteName, createResults());
}

function createCombinedPipeline(compiledDictionary) {
  return createTextPipeline()
    .use(createEmailFilter())
    .use(createUrlFilter())
    .use(createPhoneFilter())
    .use(createProfanityFilterFromCompiledDictionary(compiledDictionary));
}

function getOptionalExport(packageExports, name) {
  const value = packageExports[name];
  return typeof value === "function" ? value : undefined;
}

function uniqueNames(names) {
  return [...new Set(names)];
}

function getCombinedScannerCapabilities(compiledDictionary) {
  const createEmailScanner = getOptionalExport(emailPackage, "createEmailScanner");
  const createUrlScanner = getOptionalExport(urlPackage, "createUrlScanner");
  const createPhoneScanner = getOptionalExport(phonePackage, "createPhoneScanner");
  const createProfanityScanner = getOptionalExport(
    profanityPackage,
    "createProfanityScanner",
  );

  const missingScannerExports = uniqueNames(
    [
      ["@textfilters/email", createEmailScanner],
      ["@textfilters/url", createUrlScanner],
      ["@textfilters/phone", createPhoneScanner],
      ["@textfilters/profanity", createProfanityScanner],
    ]
      .filter(([, factory]) => factory === undefined)
      .map(([packageName]) => packageName),
  );

  if (missingScannerExports.length > 0) {
    return {
      scanners: undefined,
      missingScannerExports,
    };
  }

  return {
    scanners: [
      createEmailScanner(),
      createUrlScanner(),
      createPhoneScanner(),
      createProfanityScanner({
        filter: createProfanityFilterFromCompiledDictionary(compiledDictionary),
      }),
    ],
    missingScannerExports,
  };
}

function createCombinedScannerPipeline(compiledDictionary) {
  const createTextRangePipeline = getOptionalExport(
    corePackage,
    "createTextRangePipeline",
  );
  const capabilities = getCombinedScannerCapabilities(compiledDictionary);
  const missingExports = uniqueNames(
    [
      ["@textfilters/core", createTextRangePipeline],
      ...capabilities.missingScannerExports.map((packageName) => [
        packageName,
        undefined,
      ]),
    ]
      .filter(([, factory]) => factory === undefined)
      .map(([packageName]) => packageName),
  );

  if (missingExports.length > 0) {
    console.warn(
      `Skipping combined scanner pipeline rows; missing scanner exports from ${missingExports.join(", ")}.`,
    );
    return undefined;
  }

  return capabilities.scanners.reduce(
    (pipeline, scanner) => pipeline.use(scanner),
    createTextRangePipeline(),
  );
}

function createSharedHintsCombinedScanner(compiledDictionary) {
  const checkTextRanges = getOptionalExport(corePackage, "checkTextRanges");
  const censorCodePointRanges = getOptionalExport(
    corePackage,
    "censorCodePointRanges",
  );
  const scanTextRanges = getOptionalExport(corePackage, "scanTextRanges");
  const capabilities = getCombinedScannerCapabilities(compiledDictionary);
  const missingExports = uniqueNames(
    [
      ["@textfilters/core", checkTextRanges],
      ["@textfilters/core", censorCodePointRanges],
      ["@textfilters/core", scanTextRanges],
      ...capabilities.missingScannerExports.map((packageName) => [
        packageName,
        undefined,
      ]),
    ]
      .filter(([, factory]) => factory === undefined)
      .map(([packageName]) => packageName),
  );

  if (missingExports.length > 0) {
    console.warn(
      `Skipping shared-hints combined scanner rows; missing scanner exports from ${missingExports.join(", ")}.`,
    );
    return undefined;
  }

  const scanners = capabilities.scanners;
  return {
    check(value) {
      return checkTextRanges(value, scanners);
    },
    scan(value) {
      return scanTextRanges(value, scanners);
    },
    censor(value) {
      const result = scanTextRanges(value, scanners);
      return censorCodePointRanges(result.codePoints, result.ranges);
    },
  };
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

runSuite("core", "core · pipeline", () => {
  const urlFilter = createUrlFilter();
  const emailFilter = createEmailFilter();

  const single = createTextPipeline().use(urlFilter);
  const multi = createTextPipeline().use(emailFilter).use(urlFilter);

  return [
    bench("pipeline · create single-filter pipeline", () =>
      createTextPipeline().use(urlFilter),
      SETUP_ITERATIONS,
    ),
    bench("pipeline · create multi-filter pipeline", () =>
      createTextPipeline().use(urlFilter).use(emailFilter),
      SETUP_ITERATIONS,
    ),
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
});

// ---------------------------------------------------------------------------
// url
// ---------------------------------------------------------------------------

runSuite("url", "url", () => {
  const f = createUrlFilter();
  const fCustomMask = createUrlFilter({ maskChar: "█" });

  return [
    bench("url · createUrlFilter()", () => createUrlFilter(), SETUP_ITERATIONS),
    bench("url · censor · short clean", () => f.censor(SHORT_CLEAN)),
    bench("url · censor · long clean", () => f.censor(LONG_CLEAN)),
    bench("url · censor · short match", () => f.censor(SHORT_URL)),
    bench("url · censor · long match late", () => f.censor(LONG_URL_LATE)),
    bench("url · censor · custom maskChar · short match", () =>
      fCustomMask.censor(SHORT_URL),
    ),
  ];
});

// ---------------------------------------------------------------------------
// email
// ---------------------------------------------------------------------------

runSuite("email", "email", () => {
  const f = createEmailFilter();
  const fCustomMask = createEmailFilter({ maskChar: "▪" });

  return [
    bench("email · createEmailFilter()", () => createEmailFilter(), SETUP_ITERATIONS),
    bench("email · censor · short clean", () => f.censor(SHORT_CLEAN)),
    bench("email · censor · long clean", () => f.censor(LONG_CLEAN)),
    bench("email · censor · short match", () => f.censor(SHORT_EMAIL)),
    bench("email · censor · long match late", () => f.censor(LONG_EMAIL_LATE)),
    bench("email · censor · custom maskChar · short match", () =>
      fCustomMask.censor(SHORT_EMAIL),
    ),
  ];
});

// ---------------------------------------------------------------------------
// phone
// ---------------------------------------------------------------------------

runSuite("phone", "phone", () => {
  const f = createPhoneFilter();
  const fCustomMask = createPhoneFilter({ maskChar: "•" });

  return [
    bench("phone · createPhoneFilter()", () => createPhoneFilter(), SETUP_ITERATIONS),
    bench("phone · censor · short clean", () => f.censor(SHORT_CLEAN)),
    bench("phone · censor · long clean", () => f.censor(LONG_CLEAN)),
    bench("phone · censor · short match", () => f.censor(SHORT_PHONE)),
    bench("phone · censor · long match late", () => f.censor(LONG_PHONE_LATE)),
    bench("phone · censor · custom maskChar · short match", () =>
      fCustomMask.censor(SHORT_PHONE),
    ),
  ];
});

// ---------------------------------------------------------------------------
// profanity
// ---------------------------------------------------------------------------

runSuite("profanity", "profanity", () => {
  const compiled = compileProfanityDictionary(russianProfanityDictionary);
  const f = createProfanityFilterFromDictionary(russianProfanityDictionary);
  const fCompiled = createProfanityFilterFromCompiledDictionary(compiled);

  return [
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
});

// ---------------------------------------------------------------------------
// spam: every case creates its own guard and uses explicit nowMs values
// ---------------------------------------------------------------------------

runSuite("spam", "spam", () => {
  let t = 1_000_000;
  const nextT = (gap = 2000) => (t += gap);
  const allowedFilter = createSpamFilter({ minIntervalMs: 0 });
  let allowedMessageId = 0;

  return [
    bench("spam · createSpamFilter()", () => createSpamFilter(), SETUP_ITERATIONS),
    bench(
      "spam · check · allowed · short",
      () =>
        allowedFilter.check({
          actorKey: "u1",
          text: `allowed ${allowedMessageId++}`,
          nowMs: nextT(),
        }),
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
          duplicateWindowMs: 1_000,
          burstMaxMessages: 100,
          burstWindowMs: 1_000,
        });
        for (let i = 0; i < 50; i++) {
          sf.check({ actorKey: "u1", text: `msg ${i}`, nowMs: nextT(100) });
        }
      },
      500,
    ),
    bench(
      "spam · check · many actors · maxActors pruning",
      () => {
        const sf = createSpamFilter({
          maxActors: 10,
          minIntervalMs: 0,
          burstMaxMessages: 100,
        });
        const base = nextT(10_000);
        for (let i = 0; i < 50; i++) {
          sf.check({ actorKey: `u${i}`, text: `msg ${i}`, nowMs: base + i });
        }
      },
      500,
    ),
  ];
});

// ---------------------------------------------------------------------------
// combined pipeline: url + email + phone + profanity
// ---------------------------------------------------------------------------

runSuite("combined", "pipeline · url + email + phone + profanity", () => {
  const compiled = compileProfanityDictionary(russianProfanityDictionary);
  const legacyPipeline = createCombinedPipeline(compiled);
  const scannerPipeline = createCombinedScannerPipeline(compiled);
  const sharedHintsScanner = createSharedHintsCombinedScanner(compiled);

  const COMBINED_SHORT_CLEAN = "Hello, this message is clean.";
  const COMBINED_CYRILLIC_CLEAN = "Привет, как дела? Всё хорошо.";
  const COMBINED_SHORT_ALL_MATCH =
    "Пиши на evil@spam.ru или https://spam.ru, тел. +7 (999) 000-00-00, и не будь мудаком";
  const COMBINED_LONG_LATE =
    "Обычный текст без нарушений. ".repeat(50) +
    "Пиши на evil@spam.ru или https://spam.ru тел +7 (999) 000-00-00 блять";
  const COMBINED_MIXED_OVERLAPS =
    "Contact admin@example.com, https://example.com/support, +1 555 123 4567, хуй";
  const COMBINED_OBFUSCATED_PROFANITY =
    "Looks ordinary, but б л я т ь appears between safe words.";

  const scenarios = [
    ["short clean", COMBINED_SHORT_CLEAN],
    ["long clean", LONG_CLEAN],
    ["short all-match", COMBINED_SHORT_ALL_MATCH],
    ["long match late", COMBINED_LONG_LATE],
    ["mixed overlaps", COMBINED_MIXED_OVERLAPS],
    ["cyrillic clean", COMBINED_CYRILLIC_CLEAN],
    ["obfuscated", COMBINED_OBFUSCATED_PROFANITY],
  ];

  const results = [
    bench("combined pipeline · create composed pipeline", () =>
      createCombinedPipeline(compiled),
      SETUP_ITERATIONS,
    ),
  ];

  if (scannerPipeline !== undefined) {
    results.push(
      bench("combined scanner ranges · create pipeline", () =>
        createCombinedScannerPipeline(compiled),
        SETUP_ITERATIONS,
      ),
    );
  }

  if (sharedHintsScanner !== undefined) {
    results.push(
      bench("combined shared hints · create scanner set", () =>
        createSharedHintsCombinedScanner(compiled),
        SETUP_ITERATIONS,
      ),
    );
  }

  for (const [label, input] of scenarios) {
    results.push(
      bench(`combined legacy sequential · censor · ${label}`, () =>
        legacyPipeline.censor(input),
      ),
    );

    if (scannerPipeline !== undefined) {
      results.push(
        bench(`combined scanner ranges · scan · ${label}`, () =>
          scannerPipeline.scan(input),
        ),
        bench(`combined scanner ranges · censor · ${label}`, () =>
          scannerPipeline.censor(input),
        ),
      );
    }

    if (sharedHintsScanner !== undefined) {
      results.push(
        bench(`combined shared hints · check · ${label}`, () =>
          sharedHintsScanner.check(input),
        ),
        bench(`combined shared hints · scan · ${label}`, () =>
          sharedHintsScanner.scan(input),
        ),
        bench(`combined shared hints · censor · ${label}`, () =>
          sharedHintsScanner.censor(input),
        ),
      );
    }
  }

  return results;
});

console.log("\n✓ benchmark complete\n");
