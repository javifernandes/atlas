import { cn } from '@/lib/classes';

export const AtlasLoadingMark = ({ className }: { className?: string }) => (
  <svg
    aria-hidden='true'
    className={cn('atlas-loading-mark overflow-visible', className)}
    fill='none'
    viewBox='0 0 256 256'
  >
    <g className='text-foreground/80' stroke='currentColor' strokeLinecap='round' strokeWidth='8'>
      <path d='M128 98 L128 52'>
        <animate
          attributeName='d'
          begin='0s'
          calcMode='spline'
          dur='4.8s'
          keySplines='.4 0 .2 1;.4 0 .2 1'
          repeatCount='indefinite'
          values='M128 98 L128 52;M128 98 L128 35;M128 98 L128 52'
        />
      </path>
      <circle cx='128' cy='31' r='19'>
        <animate
          attributeName='cy'
          begin='0s'
          calcMode='spline'
          dur='4.8s'
          keySplines='.4 0 .2 1;.4 0 .2 1'
          repeatCount='indefinite'
          values='31;14;31'
        />
      </circle>

      <path d='M98 128 L52 128'>
        <animate
          attributeName='d'
          begin='-3.2s'
          calcMode='spline'
          dur='4.8s'
          keySplines='.4 0 .2 1;.4 0 .2 1'
          repeatCount='indefinite'
          values='M98 128 L52 128;M98 128 L35 128;M98 128 L52 128'
        />
      </path>
      <circle cx='31' cy='128' r='19'>
        <animate
          attributeName='cx'
          begin='-3.2s'
          calcMode='spline'
          dur='4.8s'
          keySplines='.4 0 .2 1;.4 0 .2 1'
          repeatCount='indefinite'
          values='31;14;31'
        />
      </circle>

      <path d='M153 141 C190 151 211 174 218 207'>
        <animate
          attributeName='d'
          begin='-1.6s'
          calcMode='spline'
          dur='4.8s'
          keySplines='.4 0 .2 1;.4 0 .2 1'
          repeatCount='indefinite'
          values='M153 141 C190 151 211 174 218 207;M153 141 C201 153 229 184 235 221;M153 141 C190 151 211 174 218 207'
        />
      </path>
      <circle cx='221' cy='226' r='19'>
        <animate
          attributeName='cx'
          begin='-1.6s'
          calcMode='spline'
          dur='4.8s'
          keySplines='.4 0 .2 1;.4 0 .2 1'
          repeatCount='indefinite'
          values='221;238;221'
        />
        <animate
          attributeName='cy'
          begin='-1.6s'
          calcMode='spline'
          dur='4.8s'
          keySplines='.4 0 .2 1;.4 0 .2 1'
          repeatCount='indefinite'
          values='226;240;226'
        />
      </circle>
    </g>

    <circle className='text-primary' cx='128' cy='128' r='30' stroke='currentColor' strokeWidth='10'>
      <animate
        attributeName='r'
        calcMode='spline'
        dur='3.6s'
        keySplines='.4 0 .2 1;.4 0 .2 1'
        repeatCount='indefinite'
        values='30;34;30'
      />
    </circle>
  </svg>
);
