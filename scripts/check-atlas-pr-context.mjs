#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directiveTargets = (body, directive) => {
  const targets = [];
  const lines = body.replaceAll('\r\n', '\n').split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(new RegExp(`^${directive}:\\s*(.*)$`, 'i'));
    if (!match) continue;

    const values = [];
    if (match[1]?.trim()) values.push(...match[1].split(/[,;]/));
    for (let next = index + 1; next < lines.length; next += 1) {
      const listItem = lines[next].match(/^\s*-\s+(.+?)\s*$/);
      if (!listItem) break;
      values.push(listItem[1]);
      index = next;
    }

    targets.push(
      ...values.map(value => {
        const markdownLink = value.match(/\]\(([^)]+)\)/)?.[1];
        return (markdownLink ?? value).trim().replace(/^`|`$/g, '');
      }),
    );
  }

  return targets;
};

const planTargets = planPath => {
  const key = path.basename(planPath, '.md');
  return new Set([planPath, `atlas://plans/${key}`]);
};

const isImplementationPath = filePath =>
  !filePath.endsWith('.md') &&
  !filePath.startsWith('docs/') &&
  (filePath.startsWith('src/') ||
    filePath.startsWith('scripts/') ||
    filePath.startsWith('migrations/') ||
    filePath.startsWith('.github/') ||
    filePath === 'package.json' ||
    filePath === 'pnpm-lock.yaml');

export const auditAtlasPrContext = input => {
  if (!input.changedFiles.some(isImplementationPath)) return [];

  const implementsTargets = new Set(directiveTargets(input.body, 'Atlas-Implements'));
  const shapesTargets = new Set(directiveTargets(input.body, 'Atlas-Shapes'));
  const evidenceTargets = new Set([...implementsTargets, ...shapesTargets]);
  const errors = [];

  for (const [filePath, itemId] of Object.entries(input.itemIdsByPath)) {
    if (!evidenceTargets.has(itemId)) {
      errors.push(
        `${filePath} changes durable Atlas Item ${itemId}, but the PR body does not reference it under Atlas-Implements or Atlas-Shapes.`,
      );
    }
  }

  for (const planPath of input.changedFiles.filter(filePath => /^plans\/(?:current|next|backlog|research|done)\/.+\.md$/.test(filePath))) {
    if (![...planTargets(planPath)].some(target => implementsTargets.has(target))) {
      errors.push(
        `${planPath} changes an Atlas Plan alongside implementation, but the PR body does not reference it under Atlas-Implements.`,
      );
    }
  }

  return errors;
};

const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();

const sourceAt = (revision, filePath) => {
  try {
    return git(['show', `${revision}:${filePath}`]);
  } catch {
    return '';
  }
};

const run = () => {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return;

  const event = JSON.parse(readFileSync(eventPath, 'utf8'));
  if (!event.pull_request) return;

  const base = event.pull_request.base.sha;
  const head = event.pull_request.head.sha;
  const changedFiles = git(['diff', '--name-only', '--diff-filter=ACMR', base, head, '--'])
    .split('\n')
    .filter(Boolean);
  const itemIdsByPath = Object.fromEntries(
    changedFiles
      .filter(filePath => filePath.startsWith('atlas/items/') && filePath.endsWith('.md'))
      .flatMap(filePath => {
        const id = sourceAt(head, filePath).match(/^id:\s*(\S+)\s*$/m)?.[1];
        return id ? [[filePath, id]] : [];
      }),
  );
  const errors = auditAtlasPrContext({
    body: event.pull_request.body ?? '',
    changedFiles,
    itemIdsByPath,
  });

  if (errors.length === 0) {
    console.log('Atlas PR context covers changed durable Plans and Items.');
    return;
  }

  console.error('Atlas PR context is incomplete:\n');
  errors.forEach(error => console.error(`- ${error}`));
  console.error(
    '\nUpdate the PR body following docs/atlas-evidence-binding-guidelines.md. Do not rely on commit trailers.',
  );
  process.exitCode = 1;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) run();
