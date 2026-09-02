import { AtlasMark } from '@/components/atlas-mark';

const Loading = () => (
  <main
    role='status'
    aria-labelledby='atlas-loading-title'
    aria-describedby='atlas-loading-description'
    className='fixed inset-0 grid place-items-center overflow-hidden bg-background px-6 text-foreground'
  >
    <div
      aria-hidden='true'
      className='absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(113,113,122,0.2)_1px,transparent_0)] [background-size:24px_24px]'
    />
    <div
      aria-hidden='true'
      className='absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,hsl(var(--background)/0.15)_32%,hsl(var(--background))_72%)]'
    />

    <div className='relative z-10 flex max-w-xl flex-col items-center text-center'>
      <AtlasMark className='size-36 sm:size-48' priority />
      <h1
        id='atlas-loading-title'
        className='mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl'
      >
        Atlas
      </h1>
      <p
        id='atlas-loading-description'
        className='mt-3 text-sm leading-6 text-muted-foreground sm:text-base'
      >
        Shape systems. Navigate structure. Track evolution.
      </p>

      <div aria-hidden='true' className='mt-8 flex items-center gap-2'>
        {[0, 160, 320].map(delay => (
          <span
            key={delay}
            className='size-1.5 animate-pulse rounded-full bg-primary'
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </div>
      <span className='sr-only'>Loading Atlas</span>
    </div>
  </main>
);

export default Loading;
