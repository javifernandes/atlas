'use client';

import { useOperation } from '@ontahi/react/graph';
import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { Fragment, useState, type FormEvent, type ReactNode } from 'react';

import { AtlasWorkspaceAssistantClient } from '@/atlas/client/workspace-assistant';

type Exchange = {
  question: string;
  answer: string;
  citations: Array<{ planId: string; path: string; title: string }>;
};

type Citation = Exchange['citations'][number];

const citationHref = (planId: string) =>
  `/?node=${encodeURIComponent(planId)}&full=${encodeURIComponent(planId)}`;

const citationLabel = (citation: Citation) =>
  citation.title.replace(/^\d+[a-z]?\.\s*/i, '');

const escapedPattern = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const renderCitationFallbacks = (
  text: string,
  citations: Citation[],
  openCitation: (planId: string) => void,
): ReactNode => {
  const candidates = citations
    .map(citation => ({ citation, label: citationLabel(citation) }))
    .filter(candidate => candidate.label.length > 2)
    .sort((left, right) => right.label.length - left.label.length);
  if (!candidates.length) return text;
  const pattern = new RegExp(`(${candidates.map(candidate => escapedPattern(candidate.label)).join('|')})`, 'gi');

  return text.split(pattern).map((part, index) => {
    const candidate = candidates.find(item => item.label.toLowerCase() === part.toLowerCase());
    return candidate ? (
      <Link
        className='rounded-sm font-medium text-cyan-300 underline decoration-cyan-400/35 underline-offset-4 transition hover:text-cyan-200 hover:decoration-cyan-300'
        href={citationHref(candidate.citation.planId)}
        key={index}
        onClick={event => {
          event.preventDefault();
          openCitation(candidate.citation.planId);
        }}
        title={`Open ${candidate.citation.title}`}
      >
        {part}
      </Link>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    );
  });
};

const renderInline = (
  text: string,
  citations: Citation[],
  openCitation: (planId: string) => void,
): ReactNode => {
  const citationsById = new Map(citations.map(citation => [citation.planId, citation]));
  const tokenPattern = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)/g;
  const rendered: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      rendered.push(renderCitationFallbacks(text.slice(cursor, index), citations, openCitation));
    }
    const citation = match[3] ? citationsById.get(match[3]) : undefined;
    if (citation) {
      rendered.push(
        <Link
          className='rounded-sm font-medium text-cyan-300 underline decoration-cyan-400/35 underline-offset-4 transition hover:text-cyan-200 hover:decoration-cyan-300'
          href={citationHref(citation.planId)}
          key={`${index}-${citation.planId}`}
          onClick={event => {
            event.preventDefault();
            openCitation(citation.planId);
          }}
          title={`Open ${citation.title}`}
        >
          {match[2]}
        </Link>,
      );
    } else if (match[1]) {
      rendered.push(
        <strong className='font-semibold text-foreground' key={index}>{match[1]}</strong>,
      );
    } else {
      rendered.push(renderCitationFallbacks(match[2] ?? match[0], citations, openCitation));
    }
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    rendered.push(renderCitationFallbacks(text.slice(cursor), citations, openCitation));
  }
  return rendered;
};

const AssistantAnswer = ({
  children,
  citations,
  openCitation,
}: {
  children: string;
  citations: Citation[];
  openCitation: (planId: string) => void;
}) => {
  const blocks = children.trim().split(/\n\s*\n/);

  return (
    <div className='grid gap-3 text-sm leading-6 text-foreground/90'>
      {blocks.map((block, index) => {
        const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
        const isList = lines.length > 0 && lines.every(line => /^[-*]\s+/.test(line));

        return isList ? (
          <ul className='grid gap-2 pl-1' key={index}>
            {lines.map((line, lineIndex) => (
              <li className='grid grid-cols-[auto_1fr] gap-2' key={lineIndex}>
                <span className='mt-[0.65rem] size-1.5 rounded-full bg-cyan-400' />
                <span>{renderInline(line.replace(/^[-*]\s+/, ''), citations, openCitation)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={index}>{renderInline(lines.join(' '), citations, openCitation)}</p>
        );
      })}
    </div>
  );
};

export const PlanAssistant = ({ workspaceId }: { workspaceId: string }) => {
  const askPlans = useOperation(AtlasWorkspaceAssistantClient.domain.askPlans);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openCitation = (planId: string) => {
    const url = new URL(globalThis.location.href);
    url.searchParams.set('node', planId);
    url.searchParams.set('full', planId);
    globalThis.history.pushState({}, '', url);
    globalThis.dispatchEvent(new PopStateEvent('popstate'));
  };

  const askQuestion = async () => {
    const text = question.trim();
    if (!text || askPlans.isExecuting) return;
    setError(null);
    try {
      const result = await askPlans.executeAsync({ workspace: { id: workspaceId }, question: text });
      if (!result.ok) throw new Error(result.message);
      setExchange({ question: text, ...result.value });
      setQuestion('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Atlas could not answer this question.');
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void askQuestion();
  };

  if (!open) {
    return (
      <button
        aria-label='Ask Atlas about Plans'
        className='fixed bottom-5 right-5 z-50 grid size-12 place-items-center rounded-full border border-border bg-background text-foreground shadow-lg hover:bg-muted'
        onClick={() => setOpen(true)}
        type='button'
      >
        <Bot className='size-5' />
      </button>
    );
  }

  return (
    <section
      aria-label='Atlas Plan assistant'
      className='fixed bottom-4 right-4 z-50 flex max-h-[min(42rem,calc(100dvh-2rem))] w-[min(30rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-background/95 text-foreground shadow-2xl shadow-black/40 backdrop-blur-xl'
    >
      <header className='flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-3.5'>
        <div className='flex min-w-0 items-center gap-3'>
          <span className='grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-cyan-400'>
            <Sparkles className='size-4' />
          </span>
          <div className='min-w-0'>
            <h2 className='font-medium leading-5'>Ask Atlas</h2>
            <p className='truncate text-xs text-muted-foreground'>Answers grounded in your Plans</p>
          </div>
        </div>
        <button
          aria-label='Close Plan assistant'
          className='grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground'
          onClick={() => setOpen(false)}
          type='button'
        >
          <X className='size-4' />
        </button>
      </header>

      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4'>
        {exchange ? (
          <div className='grid gap-4'>
            <div className='ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground'>
              {exchange.question}
            </div>
            <AssistantAnswer citations={exchange.citations} openCitation={openCitation}>
              {exchange.answer}
            </AssistantAnswer>
          </div>
        ) : (
          <div className='grid min-h-36 place-content-center gap-2 text-center'>
            <Bot className='mx-auto size-6 text-cyan-400/80' />
            <p className='text-sm text-muted-foreground'>Ask a question about the Plans in this Workspace.</p>
            <button
              className='text-xs text-cyan-400 hover:text-cyan-300'
              onClick={() => setQuestion('¿Qué planes hablan de workspaces?')}
              type='button'
            >
              Try an example
            </button>
          </div>
        )}
      </div>

      {error ? <p className='shrink-0 px-4 pb-2 text-sm text-destructive' role='alert'>{error}</p> : null}

      <form className='flex shrink-0 items-end gap-2 border-t border-border/60 bg-background/80 p-3' onSubmit={submit}>
        <div className='relative flex-1'>
          <textarea
            aria-label='Question about Atlas Plans'
            aria-keyshortcuts='Meta+Enter Control+Enter'
            className='min-h-11 max-h-28 w-full resize-none rounded-xl border border-border bg-muted/30 px-3 py-2.5 pr-14 text-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-cyan-400/60 focus:bg-background'
            disabled={askPlans.isExecuting}
            maxLength={2000}
            onChange={event => setQuestion(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void askQuestion();
              }
            }}
            placeholder='Ask about Plans…'
            value={question}
          />
          <kbd className='pointer-events-none absolute bottom-2.5 right-2.5 rounded border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground'>
            ⌘ ↵
          </kbd>
        </div>
        <button
          aria-label='Send question'
          className='grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400 text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-30'
          disabled={!question.trim() || askPlans.isExecuting}
          type='submit'
        >
          {askPlans.isExecuting ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
        </button>
      </form>
    </section>
  );
};
