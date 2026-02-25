"use client";

import { useMemo } from "react";
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
  handleUpload: () => void;
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
}

export default function UploadDialog({
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
}: UploadDialogProps) {
  const subcategories = useMemo(
    () => getCategorySubcategoriesForUpload(),
    [getCategorySubcategoriesForUpload],
  );

  return (
    <DialogContent className="w-full h-[100dvh] sm:h-auto sm:max-w-lg p-0 overflow-hidden flex flex-col">
      <DialogHeader className="p-6 pb-2 pr-14">
        <DialogTitle>Neues Dokument</DialogTitle>
        <DialogDescription>
          Laden Sie ein neues Dokument hoch und ergänzen Sie Details.
        </DialogDescription>
      </DialogHeader>

      <div className="relative flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
            {/* Custom Categories */}
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

          {/* Subcategory Selection - Dropdown (only for standard categories) */}
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

                {/* Create new subcategory inline */}
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

          {/* File Selection - Drag & Drop */}
          <div className="space-y-2">
            <Label>Datei</Label>
            <FileUpload
              selectedFile={uploadFile}
              onFileSelect={validateAndSetFile}
              onClear={() => setUploadFile(null)}
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              placeholder="z.B. Personalausweis"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notiz (optional)</Label>
            <Input
              id="notes"
              placeholder="z.B. Gültig bis 2028"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
            />
          </div>

          {/* Category-specific metadata fields */}
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

          {/* Help Text for metadata and power of attorney */}
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

          {/* Expiry Date */}
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

          {/* Custom Reminder - only show when expiry date is set */}
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
                Upgraden Sie auf Basic oder Premium, um Vertrauenspersonen zu
                Erinnerungen hinzuzufügen
              </p>
            </div>
          )}

          {/* Reminder Watcher - only show when expiry date is set and family members exist */}
          {uploadExpiryDate &&
            userTier.limits.familyDashboard &&
            familyMembers.length > 0 && (
              <div className="space-y-2">
                <Label>
                  Soll eine weitere Person den Termin im Blick haben?
                </Label>
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
                  Diese Person erhält eine Bestätigung und wird ebenfalls an
                  den Termin erinnert
                </p>
              </div>
            )}
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent" />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Abbrechen
        </Button>
        <Button
          onClick={handleUpload}
          disabled={
            !uploadFile || !uploadCategory || !uploadTitle.trim() || isUploading
          }
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Hinzufügen...
            </>
          ) : (
            "Hinzufügen"
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
