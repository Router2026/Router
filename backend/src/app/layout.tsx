import { runStartupChecks } from "@/lib/startup-check";

// Run once per cold start — throws in production if critical env vars are missing
runStartupChecks();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
