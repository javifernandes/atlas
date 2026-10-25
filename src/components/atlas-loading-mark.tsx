import { cn } from '@/lib/classes';

export const AtlasLoadingMark = ({ className }: { className?: string }) => (
  <svg
    aria-hidden='true'
    className={cn('atlas-loading-mark overflow-visible', className)}
    fill='none'
    viewBox='0 0 256 256'
  >
    <circle
      className='atlas-loading-stroke atlas-loading-core text-primary'
      cx='128'
      cy='128'
      pathLength='1'
      r='30'
      stroke='currentColor'
      strokeWidth='10'
      transform='rotate(-90 128 128)'
    />

    <g className='text-foreground/80' stroke='currentColor' strokeLinecap='round' strokeWidth='8'>
      <path
        className='atlas-loading-stroke atlas-loading-link-top'
        d='M128 98 L128 52'
        pathLength='1'
      />
      <circle
        className='atlas-loading-stroke atlas-loading-node-top'
        cx='128'
        cy='31'
        pathLength='1'
        r='19'
        transform='rotate(-90 128 31)'
      />
      <path
        className='atlas-loading-stroke atlas-loading-link-left'
        d='M98 128 L52 128'
        pathLength='1'
      />
      <circle
        className='atlas-loading-stroke atlas-loading-node-left'
        cx='31'
        cy='128'
        pathLength='1'
        r='19'
        transform='rotate(-90 31 128)'
      />
      <path
        className='atlas-loading-stroke atlas-loading-link-curve'
        d='M153 141 C190 151 211 174 218 207'
        pathLength='1'
      />
      <circle
        className='atlas-loading-stroke atlas-loading-node-curve'
        cx='221'
        cy='226'
        pathLength='1'
        r='19'
        transform='rotate(-90 221 226)'
      />
    </g>
  </svg>
);
