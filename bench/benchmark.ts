import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { URL } from 'node:url';

import * as tldjs from 'tldjs';
import * as publishedTldts from 'tldts-upstream';
import type { IOptions } from 'tldts-core';
import type * as currentTldtsContract from '../packages/tldts';
import type * as experimentalTldtsContract from '../packages/tldts-experimental';

const currentTldts =
  require('../packages/tldts/dist/cjs/index.js') as typeof currentTldtsContract;
const experimentalTldts =
  require('../packages/tldts-experimental/dist/cjs/index.js') as typeof experimentalTldtsContract;

const FULL_METHODS = [
  'parse',
  'getHostname',
  'getPublicSuffix',
  'getDomain',
  'getFullDomain',
  'getSubdomain',
  'getDomainWithoutSuffix',
] as const;
const IMPLEMENTATION_NAMES = [
  'current',
  'tldts',
  'experimental',
  'tldjs',
] as const;
const COMMON_METHODS = [
  'getDomain',
  'getPublicSuffix',
  'getSubdomain',
] as const;
const INPUT_GROUPS = ['url', 'hostname'] as const;
const MAX_INPUTS = 10_000;
const HIGH_SPREAD_PERCENT = 15;

const STANDARD_PROFILE = {
  name: 'standard',
  trials: 3,
  sampleDurationMs: 700,
  warmupDurationMs: 250,
} as const;
const FOCUS_PROFILE = {
  name: 'focus',
  trials: 7,
  sampleDurationMs: 1_500,
  warmupDurationMs: 750,
} as const;
const QUICK_PROFILE = {
  name: 'quick',
  trials: 3,
  sampleDurationMs: 200,
  warmupDurationMs: 50,
} as const;

const OPTIONS_BY_GROUP = {
  url: [
    undefined,
    { validateHostname: false },
    { validateHostname: false, detectIp: false, mixedInputs: false },
  ],
  hostname: [
    undefined,
    { validateHostname: false },
    {
      validateHostname: false,
      detectIp: false,
      extractHostname: false,
    },
  ],
} satisfies Record<InputGroup, readonly (Partial<IOptions> | undefined)[]>;

type MethodName = (typeof FULL_METHODS)[number];
type CommonMethodName = (typeof COMMON_METHODS)[number];
type InputGroup = (typeof INPUT_GROUPS)[number];
type ImplementationName = (typeof IMPLEMENTATION_NAMES)[number];
type BenchmarkFunction = (
  input: string,
  options?: Partial<IOptions>,
) => unknown;
type BenchmarkMethods = Record<MethodName, BenchmarkFunction>;
type RuntimeGlobal = typeof globalThis & { gc?: () => void };

interface Implementation {
  methods: Partial<BenchmarkMethods>;
  name: ImplementationName;
}

interface Profile {
  name: 'standard' | 'focus' | 'quick';
  sampleDurationMs: number;
  trials: number;
  warmupDurationMs: number;
}

interface Command {
  groups: InputGroup[];
  implementations: ImplementationName[];
  methods: MethodName[];
  profile: Profile;
  quick: boolean;
}

interface Sample {
  elapsedMs: number;
  ops: number;
}

interface Summary extends Sample {
  madPercent: number;
  spreadPercent: number;
}

interface BenchmarkCase {
  group: InputGroup;
  inputs: string[];
  method: MethodName;
  options: Partial<IOptions> | undefined;
  selected: Implementation[];
}

interface SpreadWarning {
  group: InputGroup;
  implementation: ImplementationName;
  madPercent: number;
  method: MethodName;
  options: string;
  spreadPercent: number;
}

interface ResultGroup {
  heading: string;
  rows: string[][];
}

function createTldtsMethods(
  implementation: typeof currentTldtsContract,
): BenchmarkMethods {
  return {
    getDomain: implementation.getDomain,
    getDomainWithoutSuffix: implementation.getDomainWithoutSuffix,
    getFullDomain: implementation.getFullDomain,
    getHostname: implementation.getHostname,
    getPublicSuffix: implementation.getPublicSuffix,
    getSubdomain: implementation.getSubdomain,
    parse: implementation.parse,
  };
}

const implementations: Implementation[] = [
  { name: 'current', methods: createTldtsMethods(currentTldts) },
  { name: 'tldts', methods: createTldtsMethods(publishedTldts) },
  {
    name: 'experimental',
    methods: createTldtsMethods(experimentalTldts),
  },
  {
    name: 'tldjs',
    methods: {
      getDomain: (input) => tldjs.getDomain(input),
      getPublicSuffix: (input) => tldjs.getPublicSuffix(input),
      getSubdomain: (input) => tldjs.getSubdomain(input),
    },
  },
];

function printHelp(): void {
  console.log(`Usage: yarn bench [options]

Without filters, the benchmark runs the original upstream method, input, and option matrix.
Filters retain that matrix within the selected methods and groups and use longer measurements.
Quick mode runs all methods with default options, using three short trials for the current implementation.

Options:
  --method=<names>          Limit the matrix to comma-separated methods
  --group=<names>           Limit the matrix to url, hostname, or both
  --implementation=<names>  Limit the matrix to selected implementations
  --quick                   Run a short current-implementation benchmark
  --help                    Show this help

Methods:
  ${FULL_METHODS.join(', ')}

Examples:
  yarn bench
  yarn bench --quick
  yarn bench --implementation=current
  yarn bench --method=getDomain --implementation=current,tldts
  yarn bench --method=getDomain,getPublicSuffix --group=url
  yarn bench --method=parse --group=url,hostname`);
}

function parseList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isMethodName(value: string): value is MethodName {
  return FULL_METHODS.some((method) => method === value);
}

function isInputGroup(value: string): value is InputGroup {
  return INPUT_GROUPS.some((group) => group === value);
}

function isImplementationName(value: string): value is ImplementationName {
  return IMPLEMENTATION_NAMES.some((name) => name === value);
}

function parseCommandLine(): Command | null {
  let values: {
    group?: string;
    help?: boolean;
    implementation?: string;
    method?: string;
    quick?: boolean;
  };

  try {
    ({ values } = parseArgs({
      options: {
        group: { type: 'string' },
        help: { type: 'boolean' },
        implementation: { type: 'string' },
        method: { type: 'string' },
        quick: { type: 'boolean' },
      },
      strict: true,
    }));
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return null;
  }

  if (values.help) {
    printHelp();
    return null;
  }

  const requestedMethods = values.method
    ? parseList(values.method)
    : [...FULL_METHODS];
  const requestedGroups = values.group
    ? parseList(values.group)
    : [...INPUT_GROUPS];
  const requestedImplementations = values.implementation
    ? parseList(values.implementation)
    : values.quick
      ? ['current']
      : [...IMPLEMENTATION_NAMES];
  const invalidMethod = requestedMethods.find(
    (method) => !isMethodName(method),
  );
  const invalidGroup = requestedGroups.find((group) => !isInputGroup(group));
  const invalidImplementation = requestedImplementations.find(
    (name) => !isImplementationName(name),
  );

  if (invalidImplementation) {
    console.error(
      `error: unsupported implementation: ${invalidImplementation}`,
    );
    process.exitCode = 1;
    return null;
  }

  if (invalidMethod) {
    console.error(`error: unsupported method: ${invalidMethod}`);
    process.exitCode = 1;
    return null;
  }
  if (invalidGroup) {
    console.error(`error: unsupported group: ${invalidGroup}`);
    process.exitCode = 1;
    return null;
  }

  return {
    groups: requestedGroups.filter(isInputGroup),
    implementations: requestedImplementations.filter(isImplementationName),
    methods: requestedMethods.filter(isMethodName),
    profile: values.quick
      ? QUICK_PROFILE
      : values.method || values.group || values.implementation
        ? FOCUS_PROFILE
        : STANDARD_PROFILE,
    quick: values.quick ?? false,
  };
}

function collectGarbage(): void {
  const gc = (globalThis as RuntimeGlobal).gc;
  if (!gc) {
    throw new Error('benchmark requires Node.js --expose-gc');
  }
  gc();
}

function warmup(
  fn: BenchmarkFunction,
  inputs: readonly string[],
  warmupDurationMs: number,
): void {
  const startedAt = performance.now();

  do {
    for (const input of inputs) fn(input);
  } while (performance.now() - startedAt < warmupDurationMs);

  collectGarbage();
}

function measure(
  fn: BenchmarkFunction,
  inputs: readonly string[],
  sampleDurationMs: number,
): Sample {
  for (const input of inputs) fn(input);
  collectGarbage();

  const startedAt = performance.now();
  let calls = 0;

  do {
    for (const input of inputs) fn(input);
    calls += inputs.length;
  } while (performance.now() - startedAt < sampleDurationMs);

  const elapsedMs = performance.now() - startedAt;
  return {
    elapsedMs,
    ops: (calls * 1_000) / elapsedMs,
  };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted[Math.floor(sorted.length / 2)];
  if (middle === undefined) throw new Error('cannot calculate empty median');
  return middle;
}

function summarizeSamples(samples: readonly Sample[]): Summary {
  const opsSamples = samples.map(({ ops }) => ops);
  const ops = median(opsSamples);

  return {
    elapsedMs: samples.reduce((total, sample) => total + sample.elapsedMs, 0),
    madPercent:
      (median(opsSamples.map((sample) => Math.abs(sample - ops))) / ops) * 100,
    ops,
    spreadPercent:
      ((Math.max(...opsSamples) - Math.min(...opsSamples)) / ops) * 100,
  };
}

function isCommonMethod(method: MethodName): method is CommonMethodName {
  return COMMON_METHODS.some((commonMethod) => commonMethod === method);
}

function selectImplementations(
  method: MethodName,
  group: InputGroup,
  options: Partial<IOptions> | undefined,
  requested: readonly ImplementationName[],
): Implementation[] {
  const eligible =
    isCommonMethod(method) && group === 'hostname' && options === undefined
      ? implementations
      : implementations.slice(0, 3);

  return eligible.filter(({ name }) => requested.includes(name));
}

function getMethod(
  implementation: Implementation,
  method: MethodName,
): BenchmarkFunction {
  const fn = implementation.methods[method];
  if (!fn) {
    throw new Error(`${implementation.name} does not support ${method}`);
  }
  return fn;
}

function measureCase(
  benchmarkCase: BenchmarkCase,
  profile: Profile,
): [ImplementationName, Summary][] {
  const samples: Record<ImplementationName, Sample[]> = {
    current: [],
    experimental: [],
    tldjs: [],
    tldts: [],
  };

  for (const implementation of benchmarkCase.selected) {
    const fn = getMethod(implementation, benchmarkCase.method);
    warmup(
      (input) => fn(input, benchmarkCase.options),
      benchmarkCase.inputs,
      profile.warmupDurationMs,
    );
  }

  for (let trial = 0; trial < profile.trials; trial += 1) {
    const offset = trial % benchmarkCase.selected.length;
    const order = [
      ...benchmarkCase.selected.slice(offset),
      ...benchmarkCase.selected.slice(0, offset),
    ];

    for (const implementation of order) {
      const fn = getMethod(implementation, benchmarkCase.method);
      const implementationSamples = samples[implementation.name];
      implementationSamples.push(
        measure(
          (input) => fn(input, benchmarkCase.options),
          benchmarkCase.inputs,
          profile.sampleDurationMs,
        ),
      );
    }
  }

  return benchmarkCase.selected.map(({ name }) => [
    name,
    summarizeSamples(samples[name]),
  ]);
}

function printTable(rows: readonly string[][]): void {
  const widths = [16, 14, 14, 14, 10, 10, 10];
  const align = (value: string, index: number): string => {
    const width = widths[index];
    if (width === undefined) throw new Error(`missing column width: ${index}`);
    return index === 0 ? value.padEnd(width) : value.padStart(width);
  };
  const printRow = (values: readonly string[]): void =>
    console.log(values.map(align).join('  '));

  printRow([
    'Implementation',
    'Median ops/s',
    'Median Time/op',
    'Trials',
    'MAD',
    'Spread',
    'vs tldts',
  ]);
  printRow(widths.map((width) => '-'.repeat(width)));

  for (const row of rows) printRow(row);
}

function loadInputs(): Record<InputGroup, string[]> {
  const urls = Array.from(
    new Set(
      fs
        .readFileSync(path.resolve(__dirname, 'requests.json'), 'utf8')
        .split(/[\n\r]+/g)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as { url: string })
        .map(({ url }) => url),
    ),
  ).slice(0, MAX_INPUTS);

  return {
    hostname: Array.from(
      new Set(urls.map((url) => new URL(url).hostname)),
    ).slice(0, MAX_INPUTS),
    url: urls,
  };
}

function formatOptions(options: Partial<IOptions> | undefined): string {
  return options === undefined ? 'default' : JSON.stringify(options);
}

function buildCases(
  command: Command,
  inputs: Record<InputGroup, string[]>,
): BenchmarkCase[] {
  const cases: BenchmarkCase[] = [];

  for (const method of command.methods) {
    for (const group of command.groups) {
      const options = command.quick ? [undefined] : OPTIONS_BY_GROUP[group];
      for (const option of options) {
        const selected = selectImplementations(
          method,
          group,
          option,
          command.implementations,
        );
        if (selected.length === 0) continue;

        cases.push({
          group,
          inputs: inputs[group],
          method,
          options: option,
          selected,
        });
      }
    }
  }

  return cases;
}

function formatRows(
  results: readonly [ImplementationName, Summary][],
  baselineOps: number | null,
  profile: Profile,
): string[][] {
  return results.map(([name, result]) => {
    const relative =
      baselineOps === null
        ? null
        : ((result.ops - baselineOps) / baselineOps) * 100;
    const sign = relative !== null && relative >= 0 ? '+' : '';
    const averageSampleSeconds = result.elapsedMs / profile.trials / 1_000;

    return [
      name,
      Math.floor(result.ops).toLocaleString('en-US'),
      `${(1_000_000_000 / result.ops).toFixed(2)} ns`,
      `${profile.trials} × ${averageSampleSeconds.toFixed(2)} s`,
      `${result.madPercent.toFixed(2)}%`,
      `${result.spreadPercent.toFixed(2)}%`,
      name === 'tldts'
        ? 'baseline'
        : relative === null
          ? 'n/a'
          : `${sign}${relative.toFixed(2)}%`,
    ];
  });
}

function printRuntime(): void {
  const cpu = os.cpus()[0];
  console.log(
    [
      `Runtime: node=${process.version}`,
      `v8=${process.versions.v8}`,
      `os=${os.platform()} ${os.release()} ${os.arch()}`,
      `cpu=${JSON.stringify(cpu?.model ?? 'unknown')}`,
      `logicalCpus=${os.cpus().length}`,
    ].join(' · '),
  );
}

function main(): void {
  const command = parseCommandLine();
  if (!command || process.exitCode) return;

  try {
    collectGarbage();
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  const benchmarkStartedAt = performance.now();
  const inputs = loadInputs();
  const cases = buildCases(command, inputs);
  if (cases.length === 0) {
    console.error('error: selected implementations support no requested cases');
    process.exitCode = 1;
    return;
  }
  const groups: ResultGroup[] = [];
  const warnings: SpreadWarning[] = [];

  for (const benchmarkCase of cases) {
    const results = measureCase(benchmarkCase, command.profile);
    const baseline = results.find(([name]) => name === 'tldts');
    const rows = formatRows(
      results,
      baseline?.[1].ops ?? null,
      command.profile,
    );

    for (const [name, result] of results) {
      if (result.spreadPercent > HIGH_SPREAD_PERCENT) {
        warnings.push({
          group: benchmarkCase.group,
          implementation: name,
          madPercent: result.madPercent,
          method: benchmarkCase.method,
          options: formatOptions(benchmarkCase.options),
          spreadPercent: result.spreadPercent,
        });
      }
    }

    groups.push({
      heading: [
        benchmarkCase.method,
        benchmarkCase.group,
        `options=${formatOptions(benchmarkCase.options)}`,
        `inputs=${benchmarkCase.inputs.length.toLocaleString('en-US')}`,
      ].join(' · '),
      rows,
    });
  }

  printRuntime();
  console.log(
    [
      `Benchmark: profile=${command.profile.name}`,
      `cases=${cases.length}`,
      `trials=${command.profile.trials}`,
      `sample=${command.profile.sampleDurationMs} ms`,
      `warmup=${command.profile.warmupDurationMs} ms`,
    ].join(' · '),
  );
  console.log();

  for (const group of groups) {
    console.log(group.heading);
    printTable(group.rows);
    console.log();
  }

  console.log(
    `Total: ${((performance.now() - benchmarkStartedAt) / 1_000).toFixed(2)} s`,
  );

  for (const warning of warnings) {
    console.warn(
      [
        'warning: high benchmark spread',
        `method=${warning.method}`,
        `group=${warning.group}`,
        `options=${warning.options}`,
        `implementation=${warning.implementation}`,
        `mad=${warning.madPercent.toFixed(2)}%`,
        `spread=${warning.spreadPercent.toFixed(2)}%`,
        `threshold=${HIGH_SPREAD_PERCENT.toFixed(2)}%`,
      ].join(' '),
    );
  }
}

main();
