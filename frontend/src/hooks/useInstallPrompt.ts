import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  prompt(): Promise<void>;
}

function isAlreadyInstalled(): boolean {
  return (
    globalThis.matchMedia?.('(display-mode: standalone)').matches ||
    (globalThis.navigator as Record<string, unknown>).standalone === true
  );
}

function detectIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function useInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos] = useState<boolean>(() => !isAlreadyInstalled() && detectIos());
  const [available, setAvailable] = useState<boolean>(() => !isAlreadyInstalled() && detectIos());

  useEffect(() => {
    if (isAlreadyInstalled() || isIos) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setAvailable(true);
    };
    globalThis.addEventListener('beforeinstallprompt', handler);
    return () => globalThis.removeEventListener('beforeinstallprompt', handler);
  }, [isIos]);

  const triggerInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setAvailable(false);
  };

  return { available, isIos, triggerInstall };
}
