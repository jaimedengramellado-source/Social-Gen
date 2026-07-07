"use client";

import { motion } from "framer-motion";

const CONFETTI = [
  { x: -52, y: -44, delay: 0.35, color: "var(--color-primary)" },
  { x: 48, y: -52, delay: 0.4, color: "var(--color-success)" },
  { x: -60, y: 10, delay: 0.45, color: "var(--color-success)" },
  { x: 58, y: 6, delay: 0.42, color: "var(--color-primary)" },
  { x: -30, y: -62, delay: 0.5, color: "var(--color-primary)" },
  { x: 26, y: -66, delay: 0.48, color: "var(--color-success)" },
];

interface CelebrationBurstProps {
  icon: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function CelebrationBurst({ icon, badge, className = "" }: CelebrationBurstProps) {
  return (
    <div className={`relative mx-auto h-20 w-20 ${className}`}>
      <motion.span
        className="absolute inset-0 rounded-full border-2"
        style={{ borderColor: "var(--color-primary)" }}
        initial={{ scale: 0.8, opacity: 0.6 }}
        animate={{ scale: 1.8, opacity: 0 }}
        transition={{ duration: 0.9, delay: 0.25, ease: "easeOut" }}
      />
      {CONFETTI.map((c, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: c.color }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: c.x, y: c.y, scale: 1, opacity: 0 }}
          transition={{ duration: 0.8, delay: c.delay, ease: "easeOut" }}
        />
      ))}
      <motion.div
        className="relative flex h-20 w-20 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--color-primary-light)" }}
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 16 }}
      >
        {icon}
      </motion.div>
      {badge && (
        <motion.div
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-[var(--color-background)]"
          style={{ backgroundColor: "var(--color-success)" }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.3 }}
        >
          {badge}
        </motion.div>
      )}
    </div>
  );
}
