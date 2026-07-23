"use client";

import { useState } from "react";
import { Check, Copy, Heart } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FEEDBACK_EMAIL } from "@/lib/utils";

interface FirstChatFeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FirstChatFeedbackModal({ open, onClose }: FirstChatFeedbackModalProps) {
  const [copied, setCopied] = useState(false);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // portapapeles no disponible (contexto no seguro); el enlace mailto sigue funcionando
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-11 h-11 rounded-full mb-1 bg-amber-50">
            <Heart size={20} style={{ color: "var(--color-warning)" }} fill="var(--color-warning)" />
          </div>
          <DialogTitle>Antes de empezar</DialogTitle>
          <DialogDescription>
            Vas a crear tu primer chat con la IA. Queremos que tengas la mejor experiencia
            posible, así que si en algún momento algo no va como esperas o se te ocurre una
            mejora, cuéntanoslo — leemos cada correo que llega a{" "}
            <a href={`mailto:${FEEDBACK_EMAIL}`} className="font-medium text-[var(--color-foreground)] hover:underline">
              {FEEDBACK_EMAIL}
            </a>
            .
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3 mt-2">
          <button
            onClick={copyEmail}
            className="flex items-center gap-1.5 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={13} /> Correo copiado
              </>
            ) : (
              <>
                <Copy size={13} /> Copiar correo
              </>
            )}
          </button>
          <Button onClick={onClose}>
            ¡Vamos allá! →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
