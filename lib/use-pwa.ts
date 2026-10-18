"use client";

import { useSyncExternalStore, useState } from "react";

export type DevicePlatform = "ios" | "android" | "mac" | "windows" | "other";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWAState {
  platform: DevicePlatform;
  isStandalone: boolean;
  canInstallNative: boolean;
  isInstalled: boolean;
  isMobile: boolean;
  promptInstall: () => Promise<boolean>;
}

function getPlatformSnapshot(): DevicePlatform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/macintosh|mac os x/.test(ua)) return "mac";
  if (/windows/.test(ua)) return "windows";
  return "other";
}

function getStandaloneSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isNavigatorStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isDisplayStandalone || isNavigatorStandalone;
}

const emptySubscribe = () => () => {};

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

function notifyPromptListeners() {
  promptListeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPromptGlobal = event as BeforeInstallPromptEvent;
    notifyPromptListeners();
  });

  window.addEventListener("appinstalled", () => {
    deferredPromptGlobal = null;
    notifyPromptListeners();
  });
}

function subscribeInstallPrompt(callback: () => void) {
  promptListeners.add(callback);
  return () => {
    promptListeners.delete(callback);
  };
}

export function usePWA(): PWAState {
  const platform = useSyncExternalStore(emptySubscribe, getPlatformSnapshot, () => "other" as DevicePlatform);
  const isStandalone = useSyncExternalStore(emptySubscribe, getStandaloneSnapshot, () => false);
  const canInstallNative = useSyncExternalStore(subscribeInstallPrompt, () => Boolean(deferredPromptGlobal), () => false);
  const [isInstalled, setIsInstalled] = useState(false);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPromptGlobal) return false;
    try {
      const prompt = deferredPromptGlobal;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        deferredPromptGlobal = null;
        notifyPromptListeners();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const isMobile = platform === "ios" || platform === "android";

  return {
    platform,
    isStandalone,
    canInstallNative,
    isInstalled,
    isMobile,
    promptInstall,
  };
}
