import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2] ?? resolve(import.meta.dirname, "../../..");
const suite = "spam";
const api = await import(
  pathToFileURL(resolve(root, "packages", suite, "dist/index.js"))
);
const rows = [];
function measure(label, fn, iterations) {
  for (let i = 0; i < Math.min(iterations, 10); i++) fn();
  const samples = [];
  for (let repeat = 0; repeat < 5; repeat++) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    samples.push((performance.now() - start) / iterations);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  rows.push({
    label,
    iterations,
    median: sorted[2],
    min: sorted[0],
    max: sorted[4],
    samples,
  });
}

const options = {
  minIntervalMs: 0,
  duplicateWindowMs: 1_000_000,
  burstWindowMs: 1,
  burstMaxMessages: 1000,
};
for (const n of [20, 512, 513, 16000, 64000]) {
  const text = "x".repeat(n);
  const duplicateGuard = api.createSpamGuard(options);
  assert.equal(
    duplicateGuard.check({ actorKey: "actor", text, nowMs: 0 }).allowed,
    true,
  );
  assert.equal(
    duplicateGuard.check({ actorKey: "actor", text, nowMs: 1 }).reason,
    "duplicate",
  );
  measure(
    `duplicate-${n}`,
    () => duplicateGuard.check({ actorKey: "actor", text, nowMs: 1 }),
    100,
  );
  const acceptedGuard = api.createSpamGuard({
    ...options,
    duplicateWindowMs: 1,
  });
  let now = 0;
  const accepted = () =>
    acceptedGuard.check({ actorKey: "actor", text, nowMs: (now += 2) });
  assert.equal(accepted().allowed, true);
  measure(`accepted-${n}`, accepted, 100);
}
const full = api.createSpamGuard(options);
for (let i = 0; i < 256; i++)
  assert.equal(
    full.check({
      actorKey: "full",
      text: `${i}:` + "x".repeat(16000),
      nowMs: i * 2,
    }).allowed,
    true,
  );
assert.equal(
  full.check({
    actorKey: "full",
    text: "255:" + "x".repeat(16000),
    nowMs: 1000,
  }).reason,
  "duplicate",
);
measure(
  "duplicate-full-history",
  () =>
    full.check({
      actorKey: "full",
      text: "255:" + "x".repeat(16000),
      nowMs: 1000,
    }),
  100,
);
console.log(JSON.stringify({ node: process.version, suite, rows }, null, 2));
