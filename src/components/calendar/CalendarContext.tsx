"use client";

import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";

export type CalendarSettings = {
  weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
  timeFormat: "24h" | "ampm";
  tzLabel: string; // display label in gutter; "" = auto-detect
};

export const DEFAULT_SETTINGS: CalendarSettings = {
  weekStartsOn: 1,
  timeFormat: "24h",
  tzLabel: "",
};

const LS_KEY = "sg-cal-settings";

type Ctx = {
  settings: CalendarSettings;
  update: (patch: Partial<CalendarSettings>) => void;
};

const CalendarContext = createContext<Ctx>({
  settings: DEFAULT_SETTINGS,
  update: () => {},
});

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function update(patch: Partial<CalendarSettings>) {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <CalendarContext.Provider value={{ settings, update }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalSettings() {
  return useContext(CalendarContext);
}
