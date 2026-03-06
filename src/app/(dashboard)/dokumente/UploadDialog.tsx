"use client";

import { useState } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { FileUpload } from "@/components/ui/file-upload";
import { TagInput } from "@/components/ui/tag-input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Loader2, Plus, Tag, Info } from "lucide-react";
import {
  DOCUMENT_CATEGORIES,
  CATEGORY_METADATA_FIELDS,
  type DocumentCategory,
  type Subcategory,
  type CustomCategory,
} from "@/types/database";
import { type TierConfig } from "@/lib/subscription-tiers";

interface FamilyMember {
  id: string;
  name: string;
  email: string;
}

interface UploadDialogProps {
  customCategories: CustomCategory[];
  familyMembers: FamilyMember[];
  getCategorySubcategoriesForUpload: () => Subcategory[];
  handleCreateSubcategory: () => void;
  handleUpload: () => Promise<void>;
  isCreatingSubcategory: boolean;
  isUploading: boolean;
  newSubcategoryName: string;
  onClose: () => void;
  setIsCreatingSubcategory: (value: boolean) => void;
  setNewSubcategoryName: (value: string) => void;
  setUploadCategory: (value: DocumentCategory | null) => void;
  setUploadCustomCategory: (value: string | null) => void;
  setUploadCustomReminderDays: (value: number | null) => void;
  setUploadExpiryDate: (value: string) => void;
  setUploadFile: (value: File | null) => void;
  setUploadNotes: (value: string) => void;
  setUploadReminderWatcher: (value: string | null) => void;
  setUploadSubcategory: (value: string | null) => void;
  setUploadTitle: (value: string) => void;
  uploadMetadata: Record<string, string>;
  setUploadMetadata: (value: Record<string, string>) => void;
  uploadCategory: DocumentCategory | null;
  uploadCustomCategory: string | null;
  uploadCustomReminderDays: number | null;
  uploadExpiryDate: string;
  uploadFile: File | null;
  uploadNotes: string;
  uploadReminderWatcher: string | null;
  uploadSubcategory: string | null;
  uploadTitle: string;
  userTier: TierConfig;
  validateAndSetFile: (file: File) => void;
  vaultState: "unlocked" | "locked" | "not-setup";
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  tagSuggestions?: string[];
  lockAfterUpload: boolean;
  onLockAfterUploadChange: (value: boolean) => void;
  vault: {
    unlock: (passphrase: string) => Promise<void>;
    unlockWithBiometric: () => Promise<void>;
    hasBiometricSetup: boolean;
    isBiometricSupported: boolean;
    requestSetup: () => void;
  };
}

type SubmitButtonProps = {
  uploadFile: File | null;
  uploadCategory: DocumentCategory | null;
  uploadTitle: string;
  isUploading: boolean;
  onSubmit: () => Promise<void>;
};

function SubmitUnlocked({
  uploadFile,
  uploadCategory,
  uploadTitle,
  isUploading,
  onSubmit,
}: SubmitButtonProps) {
  const isDisabled =
    !uploadFile || !uploadCategory || !uploadTitle.trim() || isUploading;

  return (
    <Button onClick={onSubmit} disabled={isDisabled}>
      {isUploading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Hinzufügen...
        </>
      ) : (
        "Hinzufügen"
      )}
    </Button>
  );
}

type SubmitLockedProps = Omit<SubmitButtonProps, "onSubmit"> & {
  vault: UploadDialogProps["vault"];
  onUnlockSuccess: () => Promise<void>;
};

function SubmitLocked({
  uploadFile,
  uploadCategory,
  uploadTitle,
  isUploading,
  vault,
  onUnlockSuccess,
}: SubmitLockedProps) {
  const [passphrase, setPassphrase] = useState("");
  const [passphraseError, setPassphraseError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  const isDisabled =
    !uploadFile ||
    !uploadCategory ||
    !uploadTitle.trim() ||
    isUploading ||
    isUnlocking;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <span>🔐 Zum Verschlüsseln Ihr Tresor-Passwort eingeben</span>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vault-passphrase">Tresor-Passwort</Label>
        <Input
          id="vault-passphrase"
          type="password"
          placeholder="Passwort eingeben…"
          value={passphrase}
          onChange={(event) => {
            setPassphrase(event.target.value);
            if (passphraseError) setPassphraseError(null);
          }}
          disabled={isUnlocking || isUploading}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {vault.hasBiometricSetup && vault.isBiometricSupported ? (
          <Button
            type="button"
            variant="secondary"
            disabled={isDisabled}
            onClick={async () => {
              setPassphraseError(null);
              setIsUnlocking(true);
              try {
                await vault.unlockWithBiometric();
                await onUnlockSuccess();
              } catch {
                setPassphraseError("Entsperren mit Biometrie fehlgeschlagen");
              } finally {
                setIsUnlocking(false);
              }
            }}
          >
            Mit Biometrie
          </Button>
        ) : null}

        <Button
          type="button"
          disabled={isDisabled}
          onClick={async () => {
            setPassphraseError(null);
            setIsUnlocking(true);
            try {
              await vault.unlock(passphrase);
              await onUnlockSuccess();
            } catch {
              setPassphraseError("Falsches Passwort");
            } finally {
              setIsUnlocking(false);
            }
          }}
        >
          {isUnlocking || isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entsperren...
            </>
          ) : (
            "Entsperren & Hochladen"
          )}
        </Button>
      </div>

      {passphraseError ? (
        <p className="text-sm text-red-600">{passphraseError}</p>
      ) : null}
    </div>
  );
}

type SubmitNotSetupProps = {
  onClose: () => void;
  onSubmit: () => Promise<void>;
  vault: UploadDialogProps["vault"];
};

function SubmitNotSetup({ onClose, onSubmit, vault }: SubmitNotSetupProps) {
  return (
    <div className="w-full space-y-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="inline-block">
              <Button disabled onClick={onSubmit}>
                Hinzufügen
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            Bitte richten Sie zuerst Ihren Tresor ein
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <button
        type="button"
        onClick={() => {
          vault.requestSetup();
          onClose();
        }}
        className="text-sm font-medium text-amber-700 underline-offset-4 hover:underline"
      >
        Tresor einrichten →
      </button>
    </div>
  );
}

function UploadDialogRoot({
  customCategories,
  familyMembers,
  getCategorySubcategoriesForUpload,
  handleCreateSubcategory,
  handleUpload,
  isCreatingSubcategory,
  isUploading,
  newSubcategoryName,
  onClose,
  setIsCreatingSubcategory,
  setNewSubcategoryName,
  setUploadCategory,
  setUploadCustomCategory,
  setUploadCustomReminderDays,
  setUploadExpiryDate,
  setUploadFile,
  setUploadNotes,
  setUploadReminderWatcher,
  setUploadSubcategory,
  setUploadTitle,
  uploadMetadata,
  setUploadMetadata,
  uploadCategory,
  uploadCustomCategory,
  uploadCustomReminderDays,
  uploadExpiryDate,
  uploadFile,
  uploadNotes,
  uploadReminderWatcher,
  uploadSubcategory,
  uploadTitle,
  userTier,
  validateAndSetFile,
  vaultState,
  tags,
  onTagsChange,
  tagSuggestions,
  lockAfterUpload,
  onLockAfterUploadChange,
  vault,
}: UploadDialogProps) {
  const subcategories = getCategorySubcategoriesForUpload();
  const handleCloseWithPendingReset = () => {
    onClose();
  };

  return (
    <DialogContent className="w-full max-h-[95dvh] sm:max-h-[90vh] sm:max-w-lg p-0 overflow-hidden flex flex-col">
      <DialogHeader className="p-6 pb-2 pr-14 flex-shrink-0">
        <DialogTitle>Neues Dokument</DialogTitle>
        <DialogDescription>
          Laden Sie ein neues Dokument hoch und ergänzen Sie Details.
        </DialogDescription>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto p-6 pr-4 space-y-6 min-h-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setUploadCategory(key as DocumentCategory);
                setUploadCustomCategory(null);
                setUploadSubcategory(null);
                setIsCreatingSubcategory(false);
                setUploadMetadata({});
              }}
              className={`p-3 text-left rounded-lg border-2 transition-colors ${
                uploadCategory === key && !uploadCustomCategory
                  ? "border-sage-500 bg-sage-50 text-sage-800"
                  : "border-warmgray-200 hover:border-warmgray-400 text-warmgray-700"
              }`}
            >
              <span className="text-sm font-medium">{category.name}</span>
            </button>
          ))}
          {customCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setUploadCategory("sonstige");
                setUploadCustomCategory(cat.id);
                setUploadSubcategory(null);
                setIsCreatingSubcategory(false);
                setUploadMetadata({});
              }}
              className={`p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-2 ${
                uploadCustomCategory === cat.id
                  ? "border-sage-500 bg-sage-50 text-sage-800"
                  : "border-warmgray-200 hover:border-warmgray-400 text-warmgray-700"
              }`}
            >
              <Tag className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{cat.name}</span>
            </button>
          ))}
        </div>

        {uploadCategory && !uploadCustomCategory && (
          <div className="space-y-2">
            <Label>Unterordner (optional)</Label>
            <div className="space-y-2">
              <select
                value={uploadSubcategory || "_none"}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "_new") {
                    setIsCreatingSubcategory(true);
                    setUploadSubcategory(null);
                  } else if (value === "_none") {
                    setUploadSubcategory(null);
                    setIsCreatingSubcategory(false);
                  } else {
                    setUploadSubcategory(value);
                    setIsCreatingSubcategory(false);
                  }
                }}
                className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
              >
                <option value="_none">Kein Unterordner</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    📁 {sub.name}
                  </option>
                ))}
                <option value="_new">+ Neuen Unterordner erstellen...</option>
              </select>

              {isCreatingSubcategory && (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Name des Unterordners"
                    value={newSubcategoryName}
                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateSubcategory();
                      }
                    }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={handleCreateSubcategory}
                    disabled={!newSubcategoryName.trim()}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setIsCreatingSubcategory(false);
                      setNewSubcategoryName("");
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Datei</Label>
          <FileUpload
            selectedFile={uploadFile}
            onFileSelect={validateAndSetFile}
            onClear={() => setUploadFile(null)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Titel</Label>
          <Input
            id="title"
            placeholder="z.B. Personalausweis"
            value={uploadTitle}
            onChange={(e) => setUploadTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notiz (optional)</Label>
          <Input
            id="notes"
            placeholder="z.B. Gültig bis 2028"
            value={uploadNotes}
            onChange={(e) => setUploadNotes(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Tags (optional)</Label>
          <TagInput
            value={tags}
            onChange={(newTags) => onTagsChange(newTags.slice(0, 10))}
            placeholder="z.B. wichtig, 2024, steuer"
            suggestions={tagSuggestions}
          />
          <p className="text-xs text-warmgray-500">{tags.length}/10 Tags</p>
        </div>

        {uploadCategory &&
          CATEGORY_METADATA_FIELDS[uploadCategory] &&
          CATEGORY_METADATA_FIELDS[uploadCategory]!.length > 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-sage-600" />
                Zusätzliche Angaben
              </Label>
              {CATEGORY_METADATA_FIELDS[uploadCategory]!.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`meta-${field.key}`} className="text-sm">
                    {field.label}
                    {field.required ? " *" : " (optional)"}
                  </Label>
                  {field.type === "select" && field.options ? (
                    <select
                      id={`meta-${field.key}`}
                      value={uploadMetadata[field.key] || ""}
                      onChange={(e) =>
                        setUploadMetadata({
                          ...uploadMetadata,
                          [field.key]: e.target.value,
                        })
                      }
                      className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                    >
                      <option value="">{field.label} wählen...</option>
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`meta-${field.key}`}
                      type={field.type === "date" ? "date" : "text"}
                      placeholder={field.label}
                      value={uploadMetadata[field.key] || ""}
                      onChange={(e) =>
                        setUploadMetadata({
                          ...uploadMetadata,
                          [field.key]: e.target.value,
                        })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}

        {uploadCategory &&
          [
            "gesundheit",
            "bevollmaechtigungen",
            "testament",
            "rente",
            "familie",
            "religion",
          ].includes(uploadCategory) && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-sage-50 border border-sage-200">
              <Info className="w-4 h-4 text-sage-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-sage-800">
                <p>
                  Nutzen Sie das Notizfeld, um zusätzliche Angaben zu erfassen
                  (z.B. Versicherungsnummern, beteiligte Personen oder
                  Gültigkeitsdaten).
                </p>
                {uploadCategory === "gesundheit" && (
                  <p className="mt-1 text-sage-700">
                    Medizinische Vollmachten (z.B. Patientenverfügung) können
                    hier oder in der Kategorie &quot;Vollmachten&quot;
                    hochgeladen werden.
                  </p>
                )}
                {uploadCategory === "bevollmaechtigungen" && (
                  <p className="mt-1 text-sage-700">
                    Vollmachten und Verfügungen können auch im Bereich
                    &quot;Notfall&quot; verwaltet werden.
                  </p>
                )}
                {uploadCategory === "testament" && (
                  <p className="mt-1 text-sage-700">
                    Bewahren Sie das Originaltestament sicher auf (z.B. beim
                    Notar) und hinterlegen Sie hier eine gut lesbare Kopie.
                  </p>
                )}
              </div>
            </div>
          )}

        <div className="space-y-2">
          <Label>Ablaufdatum (optional)</Label>
          <DatePicker
            value={uploadExpiryDate}
            onChange={(value) => {
              setUploadExpiryDate(value);
              if (!value) {
                setUploadReminderWatcher(null);
              }
            }}
            minDate={new Date().toISOString().split("T")[0]}
            placeholder="Ablaufdatum wählen"
          />
          <p className="text-xs text-warmgray-500">
            Sie werden automatisch erinnert, wenn das Dokument bald abläuft
          </p>
        </div>

        {uploadExpiryDate && (
          <div className="space-y-2">
            <Label>Erinnerung (optional)</Label>
            <select
              value={
                uploadCustomReminderDays === null
                  ? "_default"
                  : uploadCustomReminderDays.toString()
              }
              onChange={(e) => {
                const value = e.target.value;
                if (value === "_default") {
                  setUploadCustomReminderDays(null);
                } else {
                  setUploadCustomReminderDays(parseInt(value, 10));
                }
              }}
              className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
            >
              <option value="_default">Standard (aus Einstellungen)</option>
              <option value="1">1 Tag vorher</option>
              <option value="3">3 Tage vorher</option>
              <option value="7">7 Tage vorher</option>
              <option value="14">14 Tage vorher</option>
              <option value="30">1 Monat vorher</option>
              <option value="60">2 Monate vorher</option>
              <option value="90">3 Monate vorher</option>
              <option value="180">6 Monate vorher</option>
            </select>
            <p className="text-xs text-warmgray-500">
              Überschreibt die allgemeine Erinnerungseinstellung für dieses
              Dokument
            </p>
          </div>
        )}

        {uploadExpiryDate && !userTier.limits.familyDashboard && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p
              className="text-sm text-amber-800"
              data-testid="reminder-watcher-upgrade-hint"
            >
              Upgraden Sie auf Basis oder Vorsorge, um Vertrauenspersonen zu
              Erinnerungen hinzuzufügen
            </p>
          </div>
        )}

        {uploadExpiryDate &&
          userTier.limits.familyDashboard &&
          familyMembers.length > 0 && (
            <div className="space-y-2">
              <Label>Soll eine weitere Person den Termin im Blick haben?</Label>
              <select
                value={uploadReminderWatcher || "_none"}
                onChange={(e) => {
                  const value = e.target.value;
                  setUploadReminderWatcher(value === "_none" ? null : value);
                }}
                className="w-full h-10 px-3 rounded-md border border-warmgray-200 bg-white text-warmgray-900 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent"
                data-testid="reminder-watcher-select"
              >
                <option value="_none">Nein, nur ich</option>
                {familyMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} ({member.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-warmgray-500">
                Diese Person erhält eine Bestätigung und wird ebenfalls an den
                Termin erinnert
              </p>
            </div>
          )}

        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <input
            type="checkbox"
            id="lock-after-upload"
            checked={lockAfterUpload}
            onChange={(e) => onLockAfterUploadChange(e.target.checked)}
            className="h-4 w-4 rounded border-warmgray-300 accent-amber-500"
          />
          <Label
            htmlFor="lock-after-upload"
            className="text-amber-900 font-medium cursor-pointer"
          >
            🔒 Dokument nach Upload sperren
          </Label>
        </div>
      </div>

      <DialogFooter className="px-6 pb-6 pt-3">
        <Button variant="outline" onClick={handleCloseWithPendingReset}>
          Abbrechen
        </Button>
        {vaultState === "unlocked" ? (
          <SubmitUnlocked
            uploadFile={uploadFile}
            uploadCategory={uploadCategory}
            uploadTitle={uploadTitle}
            isUploading={isUploading}
            onSubmit={handleUpload}
          />
        ) : null}
        {vaultState === "locked" ? (
          <SubmitLocked
            uploadFile={uploadFile}
            uploadCategory={uploadCategory}
            uploadTitle={uploadTitle}
            isUploading={isUploading}
            vault={vault}
            onUnlockSuccess={handleUpload}
          />
        ) : null}
        {vaultState === "not-setup" ? (
          <SubmitNotSetup
            onClose={handleCloseWithPendingReset}
            onSubmit={handleUpload}
            vault={vault}
          />
        ) : null}
      </DialogFooter>
    </DialogContent>
  );
}

const UploadDialog = Object.assign(UploadDialogRoot, {
  SubmitUnlocked,
  SubmitLocked,
  SubmitNotSetup,
});

export default UploadDialog;
