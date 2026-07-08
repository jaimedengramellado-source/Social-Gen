"use client";

import { ToastProvider } from "@/components/ui/toast";
import { RouteProgress } from "@/components/shared/route-progress";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <RouteProgress />
      {children}
    </ToastProvider>
  );
}
