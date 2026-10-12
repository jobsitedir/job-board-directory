import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile('manifest.json', 'utf8')) as {count: number; files: Record<string, string>};
function requireCondition(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const keys = ['schema_version', 'domain', 'name', 'website', 'profile', 'site_type', 'primary_country', 'primary_industry', 'description', 'logo', 'screenshot'].sort();
requireCondition(JSON.stringify(Object.keys(manifest).sort()) === JSON.stringify(['schema_version', 'version', 'generated_at', 'data_cutoff', 'count', 'license', 'files'].sort()), 'Unexpected manifest fields');
const metadata = manifest as unknown as {schema_version: number; version: string; generated_at: string; data_cutoff: string; license: string};
requireCondition(metadata.schema_version === 1 && /^\d{4}-(0[1-9]|1[0-2])(?:\.r[1-9]\d*)?$/.test(metadata.version) && metadata.license === 'CC-BY-NC-4.0', 'Invalid manifest metadata');
requireCondition(Number.isFinite(Date.parse(metadata.generated_at)) && Number.isFinite(Date.parse(metadata.data_cutoff)), 'Invalid manifest dates');
let records = 0;
const references = new Set<string>();
for (const [file, hash] of Object.entries(manifest.files)) {
  requireCondition(!path.isAbsolute(file) && !file.split('/').includes('..') && !file.includes('\\'), 'Unsafe file path');
  requireCondition(/^(README\.md|LICENSE|NOTICE\.md|CONTRIBUTING\.md|CODE_OF_CONDUCT\.md|SECURITY\.md|CITATION\.cff|CHANGELOG\.md|data\/[a-z0-9.-]+\.json|assets\/(logos|screenshots)\/[a-z0-9.-]+\.webp|(?:countries|industries)\/[a-z0-9-]+\.md|docs\/(methodology|data-dictionary|usage)\.md|scripts\/(validate\.ts|LICENSE)|schema\/job-board\.schema\.json|\.github\/workflows\/validate\.yml|\.github\/ISSUE_TEMPLATE\/(correction|rights|suggestion)\.yml|\.github\/PULL_REQUEST_TEMPLATE\.md)$/.test(file), 'File outside distribution scope');
  const bytes = await readFile(file);
  requireCondition(createHash('sha256').update(bytes).digest('hex') === hash, `Checksum mismatch: ${file}`);
  requireCondition(!/\.csv$/i.test(file), 'CSV is not distributed');
  if (!file.startsWith('data/')) continue;
  const record = JSON.parse(bytes.toString()) as Record<string, unknown>;
  requireCondition(JSON.stringify(Object.keys(record).sort()) === JSON.stringify(keys), `Unexpected fields: ${file}`);
  requireCondition(record.schema_version === 1 && typeof record.domain === 'string' && /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(record.domain) && file === `data/${record.domain}.json`, 'Invalid domain');
  requireCondition(typeof record.name === 'string' && record.name.length > 0 && record.name.length <= 160, 'Invalid name');
  requireCondition(record.website === `https://${record.domain}/`, 'Invalid website');
  const profile = new URL(String(record.profile));
  requireCondition(profile.origin === 'https://jobsitedir.com' && profile.pathname === `/jobboard/${record.domain}`, 'Invalid profile');
  for (const key of ['site_type', 'primary_country', 'primary_industry', 'description']) requireCondition(record[key] === null || (typeof record[key] === 'string' && record[key].length <= (key === 'description' ? 180 : 100)), `Invalid ${key}`);
  for (const kind of ['logo', 'screenshot']) {
    if (record[kind] === null) continue;
    const media = record[kind] as Record<string, unknown>;
    requireCondition(media && JSON.stringify(Object.keys(media).sort()) === JSON.stringify(['captured_at', 'notice', 'path']), 'Invalid media fields');
    const expected = `../assets/${kind === 'logo' ? 'logos' : 'screenshots'}/${record.domain}.webp`;
    requireCondition(media.path === expected && media.notice === 'Logos and website screenshots are provided for identification and reference. Rights belong to their respective owners. Their inclusion does not imply endorsement.', 'Invalid media attribution');
    requireCondition(media.captured_at === null || (typeof media.captured_at === 'string' && Number.isFinite(Date.parse(media.captured_at))), 'Invalid screenshot date');
    references.add(expected.slice(3));
    requireCondition(expected.slice(3) in manifest.files, 'Missing media');
  }
  records++;
}
requireCondition(records > 0 && records <= 1000 && records === manifest.count, 'Invalid record count');
for (const file of Object.keys(manifest.files)) if (file.startsWith('assets/')) requireCondition(references.has(file), 'Orphan media');
for (const folder of ['data', 'assets/logos', 'assets/screenshots']) {
  for (const file of await readdir(folder).catch(() => [] as string[])) requireCondition(`${folder}/${file}` in manifest.files, 'Unmanaged data or asset');
}
for (const file of Object.keys(manifest.files).filter(file => file.endsWith('.md'))) {
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
    requireCondition(resolved.startsWith(`${root}${path.sep}`), 'Link outside repository');
    await readFile(resolved);
  }
}
console.log(`Validated ${records} website records.`);
