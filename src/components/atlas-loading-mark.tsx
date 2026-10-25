import { cn } from '@/lib/classes';

export const AtlasLoadingMark = ({ className }: { className?: string }) => (
  <svg
    aria-hidden='true'
    className={cn('atlas-loading-mark overflow-visible', className)}
    fill='none'
    viewBox='0 0 256 256'
  >
    <g className='text-foreground/80' stroke='currentColor' strokeLinecap='round' strokeWidth='8'>
      <g className='atlas-loading-pseudopod atlas-loading-pseudopod-top'>
        <path d='M128 98 L128 52' />
        <circle cx='128' cy='31' r='19' />
      </g>
      <g className='atlas-loading-pseudopod atlas-loading-pseudopod-left'>
        <path d='M98 128 L52 128' />
        <circle cx='31' cy='128' r='19' />
      </g>
      <g className='atlas-loading-pseudopod atlas-loading-pseudopod-curve'>
        <path d='M153 141 C190 151 211 174 218 207' />
        <circle cx='221' cy='226' r='19' />
      </g>
    </g>

    <circle
      className='atlas-loading-core text-primary'
      cx='128'
      cy='128'
      r='30'
      stroke='currentColor'
      strokeWidth='10'
    />
  </svg>
);
