import { runStartupChecks } from "@/lib/startup-check";

// Run once per cold start — skip during `next build` (env vars are runtime-only on Vercel)
if (process.env.NEXT_PHASE !== 'phase-production-build') {
  runStartupChecks();
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he">
      <body>{children}</body>
    </html>
  );
}
