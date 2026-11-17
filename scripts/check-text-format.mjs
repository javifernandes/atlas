import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
).split('\0').filter(Boolean);

const failures = [];

for (const file of files) {
  const bytes = readFileSync(file);
  if (bytes.includes(0)) continue;
  const text = bytes.toString('utf8');
  const lines = text.split('\n');

  lines.forEach((line, index) => {
    if (/[ \t]+$/.test(line)) failures.push(`${file}:${index + 1}: trailing whitespace`);
  });
  if (text.length > 0 && !text.endsWith('\n')) {
    failures.push(`${file}: missing newline at EOF`);
  } else if (text.endsWith('\n\n')) {
    failures.push(`${file}: blank line at EOF`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Checked text formatting in ${files.length} tracked and untracked files.`);
}
