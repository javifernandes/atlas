import { watch, type FSWatcher } from 'node:fs';

import { isAtlasSourceMarkdownPath } from './markdown-source';

export type LocalSourceChange = {
  eventType: 'change' | 'rename';
  relativePath: string;
};

export type SerializedDebouncedTask = {
  close: () => void;
  schedule: (reason?: string) => void;
};

export const createSerializedDebouncedTask = (
  run: (reasons: string[]) => Promise<void>,
  options: {
    delayMs?: number;
    onError?: (error: unknown) => void;
  } = {},
): SerializedDebouncedTask => {
  const delayMs = options.delayMs ?? 350;
  const reasons = new Set<string>();
  let closed = false;
  let dirty = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const queue = () => {
    if (closed || running) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), delayMs);
  };

  const flush = async () => {
    timer = undefined;
    if (closed || running || !dirty) return;

    running = true;
    dirty = false;
    const batch = [...reasons];
    reasons.clear();

    try {
      await run(batch);
    } catch (error) {
      options.onError?.(error);
    } finally {
      running = false;
      if (dirty) queue();
    }
  };

  return {
    close: () => {
      closed = true;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
    schedule: (reason = 'change') => {
      if (closed) return;
      dirty = true;
      reasons.add(reason);
      queue();
    },
  };
};

export const observeLocalAtlasSource = (input: {
  onChange: (change: LocalSourceChange) => void;
  repoRoot: string;
  onError?: (error: Error) => void;
}): FSWatcher => {
  const watcher = watch(input.repoRoot, { recursive: true }, (eventType, fileName) => {
    if (!fileName) return;
    const relativePath = fileName.toString().replaceAll('\\', '/');
    if (!isAtlasSourceMarkdownPath(relativePath)) return;

    input.onChange({ eventType, relativePath });
  });

  if (input.onError) watcher.on('error', input.onError);
  return watcher;
};
