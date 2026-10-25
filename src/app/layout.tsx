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
    <head>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var stored=localStorage.getItem('atlas-theme');var theme=stored==='dark'||stored==='light'?stored:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');var root=document.documentElement;root.classList.toggle('dark',theme==='dark');root.style.colorScheme=theme;}catch(_){}})();`,
        }}
      />
    </head>
    <body>
      <AtlasClientProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </AtlasClientProvider>
    </body>
  </html>
);

export default RootLayout;
