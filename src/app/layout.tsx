import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';
import { AtlasClientProvider } from '@/components/atlas-client-provider';
import { ThemeProvider } from '@/components/theme-provider';

export const metadata: Metadata = {
  title: 'Workstream Atlas',
  description: 'A federated viewer for plans and semantic project models.',
};

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang='en' suppressHydrationWarning>
    <body>
      <AtlasClientProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AtlasClientProvider>
    </body>
  </html>
);

export default RootLayout;
