"use client";

import { useCallback, useSyncExternalStore } from "react";
import { defaultConfig, type SimulatorConfig } from "@/lib/ramp/config";

const STORAGE_KEY = "ramp-simulator-config";

/**
 * Simulator config as an external store.
 *
 * `useSyncExternalStore` rather than state-in-an-effect: localStorage does not
 * exist during SSR, and reading it from an effect means a second render pass.
 * The server snapshot is the defaults, so markup matches on hydration.
 */

let cache: SimulatorConfig | null = null;
const listeners = new Set<() => void>();

function read(): SimulatorConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultConfig, ...JSON.parse(raw) };
  } catch {
    // Private mode or blocked storage: fall back to the defaults.
  }
  return defaultConfig;
}

function getSnapshot(): SimulatorConfig {
  if (cache === null) cache = read();
  return cache;
}

function getServerSnapshot(): SimulatorConfig {
  return defaultConfig;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function emit() {
  for (const listener of listeners) listener();
}

export function writeConfig(next: SimulatorConfig) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal; the edit still applies for this session.
  }
  emit();
}

export function resetConfig() {
  cache = defaultConfig;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
  emit();
}

/** Kept so the ramp layout has a single place to add future providers. */
export function RampConfigProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useRampConfig() {
  const config = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const update = useCallback((next: SimulatorConfig) => writeConfig(next), []);
  const reset = useCallback(() => resetConfig(), []);
  return { config, update, reset };
}
