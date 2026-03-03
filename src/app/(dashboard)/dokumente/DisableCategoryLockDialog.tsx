"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type DisableCategoryLockMode = "unlock_all_docs" | "keep_docs_locked";

interface DisableCategoryLockDialogProps {
  open: boolean;
  categoryTitle: string;
  loading: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: {
    passphrase: string;
    mode: DisableCategoryLockMode;
  }) => Promise<void>;
}

export function DisableCategoryLockDialog({
  open,
  categoryTitle,
  loading,
  error,
  onOpenChange,
  onConfirm,
}: DisableCategoryLockDialogProps) {
  const [passphrase, setPassphrase] = useState("");
  const [mode, setMode] = useState<DisableCategoryLockMode>("unlock_all_docs");

  const handleSubmit = async () => {
    const trimmed = passphrase.trim();
    if (!trimmed) {
      return;
    }
    await onConfirm({ passphrase: trimmed, mode });
    setPassphrase("");
    setMode("unlock_all_docs");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setPassphrase("");
      setMode("unlock_all_docs");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kategorie-Schutz deaktivieren</DialogTitle>
          <DialogDescription>
            Sie deaktivieren den Schutz für <strong>{categoryTitle}</strong>. Bitte
            bestätigen Sie mit Ihrem Passwort und wählen Sie, ob Dokumente
            entsperrt werden sollen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="disable-category-lock-passphrase">Passwort</Label>
            <Input
              id="disable-category-lock-passphrase"
              type="password"
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              placeholder="Passwort eingeben"
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-warmgray-800">Dokumente</p>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-warmgray-200 p-3">
              <input
                type="radio"
                name="disable-category-lock-mode"
                value="unlock_all_docs"
                checked={mode === "unlock_all_docs"}
                onChange={() => setMode("unlock_all_docs")}
                className="mt-0.5"
              />
              <span className="text-sm text-warmgray-700">
                Alle Dokumente in dieser Kategorie entsperren
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-md border border-warmgray-200 p-3">
              <input
                type="radio"
                name="disable-category-lock-mode"
                value="keep_docs_locked"
                checked={mode === "keep_docs_locked"}
                onChange={() => setMode("keep_docs_locked")}
                className="mt-0.5"
              />
              <span className="text-sm text-warmgray-700">
                Dokumente bleiben passwortgeschutzt
              </span>
            </label>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Abbrechen
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading || !passphrase.trim()}>
            {loading ? "Prufe..." : "Schutz deaktivieren"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
