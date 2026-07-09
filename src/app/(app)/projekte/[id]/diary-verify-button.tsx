"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { verifyDiaryChain, type VerifyResult } from "./diary-actions";

export function DiaryVerifyButton({ projectId }: { projectId: string }) {
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleVerify() {
    startTransition(async () => {
      const res = await verifyDiaryChain(projectId);
      setResult(res);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="sm" onClick={handleVerify} disabled={pending} className="w-fit">
        {pending ? "Wird geprüft…" : "Tagebuch verifizieren"}
      </Button>
      <AnimatePresence>
        {result && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={
              result.valid
                ? "rounded-md bg-success/10 px-3 py-2 text-sm text-success-foreground"
                : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {result.valid
              ? "✓ Kette unversehrt"
              : `⚠ Manipulation erkannt${result.brokenAtSeq ? ` – ab Position #${result.brokenAtSeq}` : ""}`}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
