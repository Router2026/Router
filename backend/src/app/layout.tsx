import { runStartupChecks } from "@/lib/startup-check";

// Run once per cold start — throws in production if critical env vars are missing
runStartupChecks();

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he">
      <body>{children}</body>
    </html>
  );
}
