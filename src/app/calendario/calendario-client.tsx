"use client";

import { WeeklyCalendar } from "@/components/calendar/WeeklyCalendar";

type Script = { id: string; title: string };

interface Props {
  scripts: Script[];
  userEmail: string;
}

export function CalendarioClient({ scripts, userEmail }: Props) {
  return (
    <div className="px-4 pt-4 pb-20 md:pb-6 md:px-6">
      <WeeklyCalendar scripts={scripts} userEmail={userEmail} />
    </div>
  );
}
