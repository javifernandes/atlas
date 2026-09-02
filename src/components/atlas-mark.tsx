import Image from 'next/image';

import { cn } from '@/lib/classes';

export const AtlasMark = ({
  className,
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) => (
  <span aria-hidden='true' className={cn('relative inline-block shrink-0', className)}>
    <Image
      fill
      alt=''
      className='object-contain dark:hidden'
      priority={priority}
      sizes='(max-width: 640px) 144px, 192px'
      src='/brand/atlas-mark-light.png'
    />
    <Image
      fill
      alt=''
      className='hidden object-contain dark:block'
      priority={priority}
      sizes='(max-width: 640px) 144px, 192px'
      src='/brand/atlas-mark-dark-transparent.png'
    />
  </span>
);
