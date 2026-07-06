"use client";

import { AnimatePresence, motion } from "framer-motion";

export function LogoutOverlay({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backgroundColor: "var(--color-background)" }}
        >
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.35, ease: "easeOut" }}
            className="text-3xl"
            style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--color-foreground)" }}
          >
            ¡Hasta luego!
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
