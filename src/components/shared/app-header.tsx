import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { AppNav } from "./app-nav";
import { MobileNav } from "./mobile-nav";

export function AppHeader() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-background)]/90 backdrop-blur-md">
        <div className="px-4 md:px-6 py-3 flex items-center gap-4 md:gap-6">
          <Logo size="sm" />
          <div className="flex-1 hidden md:flex">
            <AppNav />
          </div>
          <ThemeToggle />
        </div>
      </header>
      <MobileNav />
    </>
  );
}
