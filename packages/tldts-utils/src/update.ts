import { writeFileSync } from 'fs';

import findBaseDir from './find-base-dir';
import loadPublicSuffixList from './list';
import { buildHashesFromRules } from './builders/hashes';
import buildTrie, { buildTrieFromRules } from './builders/trie';
import type { IRule } from './parser';

export default function () {
  console.log('Updating rules...');
  const publicSuffixList = loadPublicSuffixList();
  const parsedRules: IRule[] = [];

  // Build trie and update TypeScript file
  const trie = buildTrie(publicSuffixList, { includePrivate: true }, (rule) => {
    parsedRules.push(rule);
  });
  writeFileSync(findBaseDir('./tldts/src/data/trie.ts'), trie, 'utf-8');

  // Build trie and update TypeScript file (ICANN only)
  const icannTrie = buildTrieFromRules(parsedRules, { includePrivate: false });
  writeFileSync(
    findBaseDir('./tldts-icann/src/data/trie.ts'),
    icannTrie,
    'utf-8',
  );

  // Build hashes and update TypeScript file
  const packed = buildHashesFromRules(parsedRules);
  writeFileSync(
    findBaseDir('./tldts-experimental/src/data/hashes.ts'),
    `
// Code automatically generated using packages/tldts-utils/src/builders/hashes.ts
export default new Uint32Array([${Array.from(packed).toString()}]);
`,
    'utf-8',
  );
}
