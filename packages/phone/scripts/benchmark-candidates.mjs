import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2] ?? resolve(import.meta.dirname, "../../..");
const suite = "phone";
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

for (const [name, text] of [
  ["ascii-short", "Hello ordinary text"],
  ["ascii-long", "Hello ordinary text ".repeat(800)],
  ["unicode-long", "Обычный текст без номера 😀 ".repeat(600)],
  ["mixed-long", "Hello обычный текст 😀 ".repeat(600)],
  ["below-threshold", "Hello text ".repeat(800) + "123456789"],
]) {
  assert.equal(api.filter.check(text), false);
  for (const method of ["check", "find", "censor", "process"])
    measure(`${name}-${method}`, () => api.filter[method](text), 30);
}
console.log(JSON.stringify({ node: process.version, suite, rows }, null, 2));
