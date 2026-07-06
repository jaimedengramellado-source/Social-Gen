import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  href?: string;
}

const sizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
};

export function Logo({ size = "md", href = "/" }: LogoProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-baseline gap-[0.05em] ${sizes[size]} font-normal leading-none tracking-tight select-none`}
      style={{ fontFamily: "var(--font-instrument-serif)" }}
    >
      <span style={{ color: "var(--color-foreground)" }}>Social</span>
      <span
        style={{
          color: "var(--color-primary)",
          fontStyle: "italic",
          letterSpacing: "-0.02em",
        }}
      >
        Flamingo
      </span>
    </Link>
  );
}
