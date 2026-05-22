// src/main.tsx  ← REPLACE existing file
// Wraps the app in React Query so all pages share one cache.
// RUN FIRST:  npm install @tanstack/react-query

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.tsx';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // data stays fresh 5 min — no refetch on navigate
      gcTime: 15 * 60 * 1000,      // keep unused data in memory 15 min
      retry: 1,
      refetchOnWindowFocus: false,     // don't re-hit the server when user alt-tabs
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Analytics />
      <SpeedInsights />
    </QueryClientProvider>
  </StrictMode>,
);