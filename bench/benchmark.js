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
const TRIALS = 3;
const HIGH_SPREAD_PERCENT = 15;
const MAX_TOTAL_DURATION_MS = 50_000;

function measure(fn, inputs) {
  for (const input of inputs) fn(input);
  global.gc();

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

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}

function summarizeSamples(samples) {
  const opsSamples = samples.map(({ ops }) => ops);
  const ops = median(opsSamples);

  return {
    elapsedMs: samples.reduce((total, sample) => total + sample.elapsedMs, 0),
    ops,
    spreadPercent:
      ((Math.max(...opsSamples) - Math.min(...opsSamples)) / ops) * 100,
  };
}

function measureMethod(method, inputs) {
  const samples = new Map(implementations.map(([name]) => [name, []]));

  for (let trial = 0; trial < TRIALS; trial += 1) {
    const order = [
      ...implementations.slice(trial),
      ...implementations.slice(0, trial),
    ];

    for (const [name, implementation] of order) {
      samples.get(name).push(measure(implementation[method], inputs));
    }
  }

  return implementations.map(([name]) => [
    name,
    summarizeSamples(samples.get(name)),
  ]);
}

function printTable(rows) {
  const widths = [16, 14, 14, 14, 10, 10];
  const align = (value, index) =>
    index === 0 ? value.padEnd(widths[index]) : value.padStart(widths[index]);
  const printRow = (values) => console.log(values.map(align).join('  '));

  printRow([
    'Implementation',
    'Median ops/s',
    'Median Time/op',
    'Trials',
    'Spread',
    'vs tldts',
  ]);
  printRow(widths.map((width) => '-'.repeat(width)));

  for (const row of rows) printRow(row);
}

function main() {
  if (typeof global.gc !== 'function') {
    console.error('error: benchmark requires Node.js --expose-gc');
    process.exitCode = 1;
    return;
  }
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
  const warnings = [];

  for (const method of METHODS) {
    const results = measureMethod(method, hostnames);
    const baselineOps = results.find(([name]) => name === 'tldts')[1].ops;

    const rows = results.map(([name, result]) => {
      const relative = ((result.ops - baselineOps) / baselineOps) * 100;
      const sign = relative >= 0 ? '+' : '';
      if (result.spreadPercent > HIGH_SPREAD_PERCENT) {
        warnings.push({
          implementation: name,
          method,
          spreadPercent: result.spreadPercent,
        });
      }

      const averageSampleSeconds = result.elapsedMs / TRIALS / 1000;
      return [
        name,
        Math.floor(result.ops).toLocaleString('en-US'),
        `${(1_000_000_000 / result.ops).toFixed(2)} ns`,
        `${TRIALS} × ${averageSampleSeconds.toFixed(2)} s`,
        `${result.spreadPercent.toFixed(2)}%`,
        name === 'tldts' ? 'baseline' : `${sign}${relative.toFixed(2)}%`,
      ];
    });

    groups.push([method, rows]);
  }

  console.log(
    `Benchmark: ${hostnames.length.toLocaleString('en-US')} hostnames · ${TRIALS} trials × ${SAMPLE_DURATION_MS} ms`,
  );
  console.log();
  for (const [method, rows] of groups) {
    console.log(method);
    printTable(rows);
    console.log();
  }
  const totalDurationMs = performance.now() - benchmarkStartedAt;
  console.log(
    `Total: ${(totalDurationMs / 1000).toFixed(2)} s / ${(MAX_TOTAL_DURATION_MS / 1000).toFixed(2)} s max`,
  );

  if (totalDurationMs > MAX_TOTAL_DURATION_MS) {
    console.error(
      `error: benchmark exceeded ${MAX_TOTAL_DURATION_MS / 1000} s runtime limit`,
    );
    process.exitCode = 1;
  }

  for (const warning of warnings) {
    console.warn(
      [
        'warning: high benchmark spread',
        `method=${warning.method}`,
        `implementation=${warning.implementation}`,
        `spread=${warning.spreadPercent.toFixed(2)}%`,
        `threshold=${HIGH_SPREAD_PERCENT.toFixed(2)}%`,
      ].join(' '),
    );
  }
}

main();
