import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const rows = source.slice(source.indexOf('function LaunchRows('), source.indexOf('function AppShell('));
const explore = source.slice(source.indexOf('function ExplorePage('), source.indexOf('function LaunchDetailPage('));

test('the shared launch renderer does not silently truncate Explore results', () => {
  assert.match(rows, /items\.map\(/);
  assert.doesNotMatch(rows, /items\.slice\(/);
  assert.match(explore, /<LaunchRows items=\{items\} \/>/);
  assert.match(explore, /data\?\.nextCursor/);
});

test('only the landing preview supplies five records and its View all footer', () => {
  assert.match(source, /<LaunchRows items=\{data\.recentLaunches\.slice\(0, 5\)\} landing \/>/);
  assert.match(rows, /\{landing && <div className="landing-launch-footer">/);
});
