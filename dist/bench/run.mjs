import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { evaluate } from './engine.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const caseText = await readFile(join(root, 'cases.json'), 'utf8');
const engineText = await readFile(join(root, 'engine.mjs'), 'utf8');
const policyText = await readFile(join(root, '..', 'ares-policy.js'), 'utf8');
const fixture = JSON.parse(caseText);
const report = evaluate(fixture.cases);
report.provenance = {
  fixture: 'cases.json', fixtureSha256: createHash('sha256').update(caseText).digest('hex'),
  engine: 'engine.mjs', engineSha256: createHash('sha256').update(engineText).digest('hex'),
  sharedPolicy: '../ares-policy.js', sharedPolicySha256: createHash('sha256').update(policyText).digest('hex'),
  caseOrigin: fixture.provenance,
  command: 'node dist/bench/run.mjs',
  note: 'No random seed is needed: every authored case and result is fixed. Policy selectors never receive truth or unrevealed outcomes.'
};
const output = `${JSON.stringify(report, null, 2)}\n`;
const path = join(root, 'report.json');
if (process.argv.includes('--check')) {
  const published = await readFile(path, 'utf8');
  if (published !== output) throw new Error('Published benchmark report is not reproducible from the checked-in fixtures and engine');
  console.log('ARES-EVAL-1 report matches source byte for byte.');
} else {
  await writeFile(path, output);
  console.log(`ARES-EVAL-1: ${report.caseCount} synthetic cases; report written to ${path}`);
}
