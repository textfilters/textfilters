import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2] ?? resolve(import.meta.dirname, "../../..");
const suite = "url";
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

for (const [name, char] of [
  ["ascii", "."],
  ["unicode", "。"],
  ["selectors", ".\ufe0f"],
]) {
  for (const n of [1000, 2000, 4000, 8000, 16000]) {
    if (process.argv[3] && process.argv[3] !== `${name}-${n}`) continue;
    const text = char.repeat(n);
    assert.equal(api.filter.check(text), false);
    measure(`${name}-${n}`, () => api.filter.check(text), 1);
  }
}
console.log(JSON.stringify({ node: process.version, suite, rows }, null, 2));
