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

  return (calls * 1000) / (performance.now() - startedAt);
}

function main() {
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

  console.log(
    `inputs=${hostnames.length} sample=${SAMPLE_DURATION_MS}ms implementations=current,tldts,experimental,tldjs`,
  );

  for (const method of METHODS) {
    const results = implementations.map(([name, implementation]) => [
      name,
      measure(implementation[method], hostnames),
    ]);
    const baselineOps = results.find(([name]) => name === 'tldts')[1];

    for (const [name, ops] of results) {
      const relative = ((ops - baselineOps) / baselineOps) * 100;
      const sign = relative >= 0 ? '+' : '';

      console.log(
        [
          `method=${method}`,
          `implementation=${name}`,
          `ops=${Math.floor(ops)}`,
          name === 'tldts'
            ? 'relative=baseline'
            : `relative=${sign}${relative.toFixed(2)}%`,
        ].join(' '),
      );
    }
  }
}

main();
