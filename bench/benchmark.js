const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { URL } = require('node:url');

const implementations = [
  ['current', require('../packages/tldts/dist/cjs/index.js')],
  ['tldts', require('tldts-upstream')],
  ['experimental', require('../packages/tldts-experimental/dist/cjs/index.js')],
  ['tldjs', require('tldjs')],
];

const METHODS = ['getDomain', 'getPublicSuffix', 'getSubdomain'];
const MAX_INPUTS = 10_000;
const SAMPLE_DURATION_MS = 750;

function measure(fn, inputs) {
  for (const input of inputs) fn(input);

  const startedAt = performance.now();
  let calls = 0;

  do {
    for (const input of inputs) fn(input);
    calls += inputs.length;
  } while (performance.now() - startedAt < SAMPLE_DURATION_MS);

  const elapsedMs = performance.now() - startedAt;
  return {
    elapsedMs,
    ops: (calls * 1000) / elapsedMs,
  };
}

function printTable(rows) {
  const widths = [16, 14, 14, 10, 10];
  const align = (value, index) =>
    index === 0 ? value.padEnd(widths[index]) : value.padStart(widths[index]);
  const printRow = (values) => console.log(values.map(align).join('  '));

  printRow(['Implementation', 'ops/s', 'Time/op', 'Sample', 'vs tldts']);
  printRow(widths.map((width) => '-'.repeat(width)));

  for (const row of rows) printRow(row);
}

function main() {
  const benchmarkStartedAt = performance.now();
  const hostnames = Array.from(
    new Set(
      fs
        .readFileSync(path.resolve(__dirname, 'requests.json'), 'utf8')
        .split(/[\n\r]+/g)
        .filter(Boolean)
        .map(JSON.parse)
        .map(({ url }) => new URL(url).hostname),
    ),
  ).slice(0, MAX_INPUTS);
  const groups = [];

  for (const method of METHODS) {
    const results = implementations.map(([name, implementation]) => [
      name,
      measure(implementation[method], hostnames),
    ]);
    const baselineOps = results.find(([name]) => name === 'tldts')[1].ops;

    const rows = results.map(([name, result]) => {
      const relative = ((result.ops - baselineOps) / baselineOps) * 100;
      const sign = relative >= 0 ? '+' : '';

      return [
        name,
        Math.floor(result.ops).toLocaleString('en-US'),
        `${(1_000_000_000 / result.ops).toFixed(2)} ns`,
        `${(result.elapsedMs / 1000).toFixed(2)} s`,
        name === 'tldts' ? 'baseline' : `${sign}${relative.toFixed(2)}%`,
      ];
    });

    groups.push([method, rows]);
  }

  console.log(
    `Benchmark: ${hostnames.length.toLocaleString('en-US')} hostnames · ${SAMPLE_DURATION_MS} ms sample`,
  );
  console.log();
  for (const [method, rows] of groups) {
    console.log(method);
    printTable(rows);
    console.log();
  }
  console.log(
    `Total: ${((performance.now() - benchmarkStartedAt) / 1000).toFixed(2)} s`,
  );
}

main();
