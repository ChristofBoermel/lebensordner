"use client";

import { use, useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
const DocumentPreview = dynamic(
  () =>
    import("@/components/ui/document-preview").then(
      (mod) => mod.DocumentPreview,
    ),
  {
    loading: () => <div className="text-warmgray-600">Laden...</div>,
    ssr: false,
  },
);
import {
  User,
  Wallet,
  Shield,
  Home,
  HeartPulse,
  FileText,
  Landmark,
  Upload,
  File,
  Trash2,
  Download,
  History,
  Loader2,
  Search,
  Eye,
  AlertCircle,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Users,
  Briefcase,
  Church,
  MoveRight,
  MoreVertical,
  Check,
  X,
  Pencil,
  PlusCircle,
  Info,
  FileSignature,
  ScrollText,
  Share2,
  Lock,
  LockOpen,
  ShieldCheck,
  ShieldOff,
  Clock,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { VaultContext } from "@/lib/vault/VaultContext";
import {
  FIVE_MINUTES_MS,
} from "@/lib/dokumente/useCategoryLockState";
import {
  DOCUMENT_CATEGORIES,
  CATEGORY_METADATA_FIELDS,
  type DocumentCategory,
  type Document,
  type Subcategory,
  type CustomCategory,
} from "@/types/database";
import { formatFileSize, formatDate } from "@/lib/utils";
import { usePostHog, ANALYTICS_EVENTS } from "@/lib/posthog";
import {
  SUBSCRIPTION_TIERS,
  getTierFromSubscription,
  canUploadFile,
  canPerformAction,
  type TierConfig,
} from "@/lib/subscription-tiers";
import { UpgradeNudge, UpgradeModal } from "@/components/upgrade";
import Link from "next/link";
import { decryptField, unwrapKey } from "@/lib/security/document-e2ee";
import {
  EVENT_CATEGORY_LOCKED,
  EVENT_CATEGORY_UNLOCKED,
  EVENT_DOCUMENT_DOWNLOADED,
  EVENT_DOCUMENT_LOCKED,
  EVENT_DOCUMENT_UNLOCKED,
  EVENT_DOCUMENT_VIEWED,
} from "@/lib/security/audit-log";
import { useDocumentAuditLog } from "@/lib/security/useDocumentAuditLog";
import { ShareDocumentDialog } from "@/components/sharing/ShareDocumentDialog";
import { BulkShareDialog } from "@/components/sharing/BulkShareDialog";
import { ActiveSharesList } from "@/components/sharing/ActiveSharesList";
import { useThemeSafe } from "@/components/theme/theme-provider";
import { ExpiryDashboardWidget } from "@/components/dokumente/ExpiryDashboardWidget";
import { EncryptedNotesEditor } from "@/components/dokumente/EncryptedNotesEditor";
import {
  loadShareEligibleTrustedPersons,
  type ShareEligibleTrustedPerson,
} from "@/lib/trusted-persons/share-eligible";
import {
  DisableCategoryLockDialog,
  type DisableCategoryLockMode,
} from "./DisableCategoryLockDialog";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  user: User,
  wallet: Wallet,
  shield: Shield,
  home: Home,
  "heart-pulse": HeartPulse,
  "file-text": FileText,
  "file-signature": FileSignature,
  scroll: ScrollText,
  landmark: Landmark,
  folder: Folder,
  users: Users,
  briefcase: Briefcase,
  church: Church,
};

const categoryColorMap: Record<string, string> = {
  identitaet: "bg-blue-100 text-blue-600",
  finanzen: "bg-emerald-100 text-emerald-600",
  versicherungen: "bg-amber-100 text-amber-600",
  wohnen: "bg-orange-100 text-orange-600",
  gesundheit: "bg-red-100 text-red-600",
  vertraege: "bg-purple-100 text-purple-600",
  rente: "bg-indigo-100 text-indigo-600",
  familie: "bg-pink-100 text-pink-600",
  arbeit: "bg-cyan-100 text-cyan-600",
  religion: "bg-violet-100 text-violet-600",
  sonstige: "bg-warmgray-100 text-warmgray-600",
  bevollmaechtigungen: "bg-teal-100 text-teal-600",
  testament: "bg-amber-100 text-amber-700",
};

const LUCIDE_ICON_KEYS = Object.keys(LucideIcons).filter(
  (key) =>
    /^[A-Z]/.test(key) &&
    typeof (LucideIcons as Record<string, unknown>)[key] === "function" &&
    key !== "createLucideIcon" &&
    key !== "Icon",
);

const CUSTOM_CATEGORY_ICON_OPTIONS = LUCIDE_ICON_KEYS.map((name) => ({
  value: name,
  label: name.replace(/([A-Z])/g, " $1").trim(),
}));

function toPascalCase(input: string) {
  return input
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function resolveCategoryIcon(iconName: string | null | undefined) {
  if (!iconName) return Folder;
  const raw = iconName.trim();
  const fromStaticMap = iconMap[raw];
  if (fromStaticMap) return fromStaticMap;

  const icons = LucideIcons as unknown as Record<string, unknown>;
  const rawIcon = icons[raw];
  if (typeof rawIcon === "function") {
    return rawIcon as React.ComponentType<{ className?: string }>;
  }
  const pascal = toPascalCase(raw);
  const pascalIcon = icons[pascal];
  if (typeof pascalIcon === "function") {
    return pascalIcon as React.ComponentType<{ className?: string }>;
  }
  return Folder;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const UploadDialog = dynamic(() => import("./UploadDialog"), {
  loading: () => <div className="text-warmgray-600">Laden...</div>,
  ssr: false,
});

interface CategoryCardProps {
  categoryKey: string;
  title: string;
  description?: string | null;
  icon: React.ComponentType<{ className?: string }>;
  documentCount: number;
  securedCategories: string[];
  isVaultUnlocked: boolean;
  toggleDisabled: boolean;
  onCardClick: (categoryKey: string) => void;
  onToggleCategoryLock: (e: React.MouseEvent, categoryKey: string) => void;
  onAddDocument: (categoryKey: string) => void;
}

type SecuredCategorySupport = "unknown" | "available" | "unavailable";

interface DocumentAuditEntry {
  id: string;
  event_type: string;
  timestamp: string;
  event_data: Record<string, unknown> | null;
}

function formatRelativeTime(timestamp: string): string {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Vor ${minutes} Minute${minutes !== 1 ? "n" : ""}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Vor ${hours} Stunde${hours !== 1 ? "n" : ""}`;
  const days = Math.floor(hours / 24);
  return `Vor ${days} Tag${days !== 1 ? "en" : ""}`;
}

function CategoryCard({
  categoryKey,
  title,
  description,
  icon: Icon,
  documentCount,
  securedCategories,
  isVaultUnlocked,
  toggleDisabled,
  onCardClick,
  onToggleCategoryLock,
  onAddDocument,
}: CategoryCardProps) {
  const isSecured = securedCategories.includes(categoryKey);
  const isLocked = isSecured && !isVaultUnlocked;

  const cardContent = (
    <Card
      className={`group relative overflow-hidden cursor-pointer transition-all duration-300 border-2 ${
        isSecured
          ? "border-amber-300 bg-amber-50/20 hover:border-amber-400"
          : "border-warmgray-200 bg-white hover:border-sage-400 hover:shadow-xl"
      } senior-mode:p-2`}
      onClick={() => onCardClick(categoryKey)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onCardClick(categoryKey);
        }
      }}
    >
      <CardHeader className="pb-3 relative z-0">
        <div className="flex items-start justify-between">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              isLocked
                ? "bg-warmgray-200 text-warmgray-500 group-hover:scale-95"
                : isSecured
                  ? "bg-amber-100 text-amber-600"
                  : "bg-sage-100 text-sage-600 group-hover:bg-sage-600 group-hover:text-white group-hover:rotate-3"
            } senior-mode:w-20 senior-mode:h-20`}
          >
            {isLocked ? (
              <Lock className="w-8 h-8 senior-mode:w-10 senior-mode:h-10" />
            ) : (
              <Icon className="w-8 h-8 senior-mode:w-10 senior-mode:h-10" />
            )}
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className={`category-icon-btn h-11 w-11 rounded-full transition-all ${
                isSecured
                  ? "text-amber-600 bg-amber-100"
                  : "text-warmgray-300 hover:text-sage-600 hover:bg-sage-50"
              } senior-mode:h-14 senior-mode:w-14`}
              onClick={(event) => onToggleCategoryLock(event, categoryKey)}
              disabled={toggleDisabled}
              title={
                toggleDisabled
                  ? "Kategorie-Schutz ist in dieser Umgebung nicht verfugbar"
                  : isSecured
                    ? "Extra-Sicherheit deaktivieren"
                    : "Extra-Sicherheit aktivieren"
              }
            >
              {isSecured ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <Shield className="w-6 h-6" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="category-icon-btn h-11 w-11 rounded-full text-warmgray-300 hover:text-sage-600 hover:bg-sage-50 transition-colors senior-mode:h-14 senior-mode:w-14"
              onClick={(event) => {
                event.stopPropagation();
                onAddDocument(categoryKey);
              }}
              title="Dokument hinzufügen"
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        </div>
        <div className="pt-4">
          <CardTitle className="text-xl font-serif senior-mode:text-3xl">
            {title}
          </CardTitle>
          {description ? (
            <CardDescription className="line-clamp-2 mt-1.5 leading-relaxed senior-mode:text-xl senior-mode:mt-2">
              {description}
            </CardDescription>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="relative z-0">
        <div className="flex items-center justify-between border-t border-warmgray-100 pt-4 mt-2">
          <div className="flex flex-col">
            <p className="text-sm text-warmgray-500 senior-mode:text-lg">Inhalt</p>
            <p className="text-base font-semibold text-warmgray-900 senior-mode:text-2xl">
              <span className={isLocked ? "text-warmgray-400" : "text-sage-700"}>
                {isLocked ? "--" : documentCount}
              </span>{" "}
              Dokument{documentCount !== 1 ? "e" : ""}
            </p>
          </div>
          {isSecured ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-300 bg-amber-50/20 text-amber-700">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[11px] font-bold uppercase tracking-wider">
                {isLocked ? "Gesperrt" : "Gesichert"}
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (!isLocked) {
    return cardContent;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
      <TooltipContent>🔒 Gesperrte Kategorie – Passwort zum Entsperren eingeben</TooltipContent>
    </Tooltip>
  );
}

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialCategory = searchParams.get(
    "kategorie",
  ) as DocumentCategory | null;
  const shouldOpenUpload = searchParams.get("upload") === "true";
  const highlightDocumentId = searchParams.get("highlight");
  const tagParam = searchParams.get("tags");

  const [documents, setDocuments] = useState<Document[]>([]);
  const [highlightedDoc, setHighlightedDoc] = useState<string | null>(
    highlightDocumentId,
  );
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] =
    useState<DocumentCategory | null>(initialCategory);
  const [activeTab, setActiveTab] = useState<string>(
    initialCategory || "overview",
  );
  const [view, setView] = useState<"grid" | "list">("grid");
  const [isUploadOpen, setIsUploadOpen] = useState(shouldOpenUpload);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory | null>(
    initialCategory,
  );
  const [uploadSubcategory, setUploadSubcategory] = useState<string | null>(
    null,
  );
  const [activeTagFilters, setActiveTagFilters] = useState<Set<string>>(
    () => (tagParam ? new Set(tagParam.split(",").filter(Boolean)) : new Set()),
  );
  const [storageUsed, setStorageUsed] = useState(0);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [userTier, setUserTier] = useState<TierConfig>(SUBSCRIPTION_TIERS.free);
  const [expandedSubcategories, setExpandedSubcategories] = useState<
    Set<string>
  >(new Set());
  const [currentFolder, setCurrentFolder] = useState<Subcategory | null>(null);

  // Custom categories
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(
    [],
  );
  const [selectedCustomCategory, setSelectedCustomCategory] = useState<
    string | null
  >(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CustomCategory | null>(
    null,
  );
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
    icon: "Folder",
  });
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Category Locking state
  const [securedCategories, setSecuredCategories] = useState<string[]>([]);
  const [securedCategoriesSupport, setSecuredCategoriesSupport] =
    useState<SecuredCategorySupport>("unknown");
  const [pendingUnlockCategory, setPendingUnlockCategory] = useState<string | null>(null);
  const [pendingUnlockDocumentId, setPendingUnlockDocumentId] = useState<string | null>(null);
  const [isDisableCategoryLockDialogOpen, setIsDisableCategoryLockDialogOpen] =
    useState(false);
  const [disableCategoryLockTarget, setDisableCategoryLockTarget] =
    useState<string | null>(null);
  const [disableCategoryLockError, setDisableCategoryLockError] = useState<string | null>(null);
  const [isDisablingCategoryLock, setIsDisablingCategoryLock] = useState(false);
  const [requiresRecentUnlock, setRequiresRecentUnlock] = useState(false);
  const [privacyModeEnabled, setPrivacyModeEnabled] = useState(false);

  // Upgrade Modal state
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalFeature, setUpgradeModalFeature] = useState<
    "document" | "folder" | "trusted_person" | "storage" | "custom_category"
  >("folder");

  // New subcategory creation
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [isCreatingFolderInGrid, setIsCreatingFolderInGrid] = useState(false);
  const [newFolderCategory, setNewFolderCategory] =
    useState<DocumentCategory | null>(null);

  // Selection & Move state
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(
    new Set(),
  );
  const [pendingBulkSecurityAction, setPendingBulkSecurityAction] = useState<
    "lock" | "unlock" | null
  >(null);
  const [
    pendingBulkSecuritySelectionIds,
    setPendingBulkSecuritySelectionIds,
  ] = useState<string[] | null>(null);
  const [isAwaitingBulkSecurityUnlock, setIsAwaitingBulkSecurityUnlock] =
    useState(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [isBulkShareDialogOpen, setIsBulkShareDialogOpen] = useState(false);
  const [sharesVersion, setSharesVersion] = useState(0);
  const [bulkShareDocuments, setBulkShareDocuments] = useState<
    Array<{ id: string; title: string; wrapped_dek: string | null }>
  >([]);
  const [moveTargetFolder, setMoveTargetFolder] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isApplyingBulkSecurity, setIsApplyingBulkSecurity] = useState(false);
  const [isCreatingFolderInMove, setIsCreatingFolderInMove] = useState(false);
  const [newFolderNameInMove, setNewFolderNameInMove] = useState("");

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadExpiryDate, setUploadExpiryDate] = useState("");
  const [uploadCustomReminderDays, setUploadCustomReminderDays] = useState<
    number | null
  >(null);
  const [uploadCustomCategory, setUploadCustomCategory] = useState<
    string | null
  >(null);
  const [uploadReminderWatcher, setUploadReminderWatcher] = useState<
    string | null
  >(null);
  const [uploadMetadata, setUploadMetadata] = useState<Record<string, string>>(
    {},
  );
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [lockAfterUpload, setLockAfterUpload] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Share dialog state
  const [shareDocument, setShareDocument] = useState<Document | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  // Encrypted notes editor state
  const [notesEditorDoc, setNotesEditorDoc] = useState<Document | null>(null);
  const [auditLogDocumentId, setAuditLogDocumentId] = useState<string | null>(null);
  const [auditLogDocumentTitle, setAuditLogDocumentTitle] = useState<string | null>(null);
  const [auditLogEntries, setAuditLogEntries] = useState<DocumentAuditEntry[]>([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const handleEncryptedNoteSaveSuccess = (
    savedNote: Pick<Document, "id" | "notes_encrypted" | "notes">,
  ) => {
    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === savedNote.id
          ? {
              ...doc,
              notes_encrypted: savedNote.notes_encrypted,
              notes: savedNote.notes,
            }
          : doc,
      ),
    );
    setNotesEditorDoc((prev) =>
      prev && prev.id === savedNote.id
        ? {
            ...prev,
            notes_encrypted: savedNote.notes_encrypted,
            notes: savedNote.notes,
          }
        : prev,
    );
  };

  // Family members for reminder watcher
  const [familyMembers, setFamilyMembers] = useState<ShareEligibleTrustedPerson[]>([]);
  const [categoryIconSearch, setCategoryIconSearch] = useState("");

  const supabase = createClient();
  const vaultContext = use(VaultContext);
  if (!vaultContext) {
    throw new Error("DocumentsPage must be used within VaultProvider");
  }
  const { emit } = useDocumentAuditLog();
  const vaultState: "unlocked" | "locked" | "not-setup" = !vaultContext.isSetUp
    ? "not-setup"
    : !vaultContext.isUnlocked
      ? "locked"
      : "unlocked";
  const isUnlockRequested = vaultContext.isUnlockRequested;
  const { seniorMode } = useThemeSafe();
  const { capture } = usePostHog();

  // Load profile settings including secured categories
  useEffect(() => {
    const loadProfileData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      let profile: { subscription_status: string | null; secured_categories?: string[] | null } | null = null

      const profileWithSecured = await supabase
        .from("profiles")
        .select("subscription_status, secured_categories")
        .eq("id", user.id)
        .single();

      if (
        profileWithSecured.error &&
        (profileWithSecured.error.code === "42703" ||
          String(profileWithSecured.error.message).includes("secured_categories"))
      ) {
        setSecuredCategoriesSupport("unavailable");
        const fallbackProfile = await supabase
          .from("profiles")
          .select("subscription_status")
          .eq("id", user.id)
          .single();
        profile = fallbackProfile.data as { subscription_status: string | null } | null;
      } else {
        setSecuredCategoriesSupport("available");
        profile = profileWithSecured.data as {
          subscription_status: string | null;
          secured_categories?: string[] | null;
        } | null;
      }

      if (profile) {
        const tier = getTierFromSubscription(profile.subscription_status, null);
        setUserTier(tier);
        if (profile.secured_categories) {
          setSecuredCategories(profile.secured_categories as string[]);
        }
      }
    };
    loadProfileData();
  }, [supabase]);

  useEffect(() => {
    const stored = window.localStorage.getItem("docs_privacy_mode");
    setPrivacyModeEnabled(stored === "enabled");
  }, []);

  const filteredCategoryIconOptions = useMemo(() => {
    const query = categoryIconSearch.trim().toLowerCase();
    if (!query) return CUSTOM_CATEGORY_ICON_OPTIONS;
    return CUSTOM_CATEGORY_ICON_OPTIONS.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.value.toLowerCase().includes(query),
    );
  }, [categoryIconSearch]);

  const hasRecentUnlock =
    vaultContext.isUnlocked &&
    Date.now() - vaultContext.lastUnlockTimestamp <= FIVE_MINUTES_MS;

  useEffect(() => {
    if (!hasRecentUnlock) {
      return;
    }

    if (pendingUnlockCategory) {
      if (pendingUnlockCategory.startsWith("custom:")) {
        const customId = pendingUnlockCategory.replace("custom:", "");
        setActiveTab(`custom:${customId}`);
        setSelectedCustomCategory(customId);
        setSelectedCategory(null);
      } else {
        setActiveTab(pendingUnlockCategory);
        setSelectedCategory(pendingUnlockCategory as DocumentCategory);
        setSelectedCustomCategory(null);
      }
      setCurrentFolder(null);
      setPendingUnlockCategory(null);
    }

    if (pendingUnlockDocumentId) {
      setHighlightedDoc(pendingUnlockDocumentId);
      const target = documents.find((doc) => doc.id === pendingUnlockDocumentId);
      if (target) {
        void handleOpenDocument(target);
      }
      setPendingUnlockDocumentId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasRecentUnlock,
    pendingUnlockCategory,
    pendingUnlockDocumentId,
    documents,
    vaultContext.lastUnlockTimestamp,
  ]);

  const isDocumentLocked = useCallback(
    (doc: Document) => Boolean(doc.extra_security_enabled) && !hasRecentUnlock,
    [hasRecentUnlock],
  );

  const isSecuredCategoriesUnavailableError = (error: { code?: string; message?: string }) =>
    error.code === "42703" || String(error.message).includes("secured_categories");

  const isDocInCategory = (doc: Document, categoryKey: string) => {
    if (categoryKey.startsWith("custom:")) {
      const customId = categoryKey.replace("custom:", "");
      return doc.custom_category_id === customId;
    }
    return doc.category === categoryKey;
  };

  const getCategoryTitle = (categoryKey: string | null) => {
    if (!categoryKey) return "Kategorie";
    if (categoryKey.startsWith("custom:")) {
      const customId = categoryKey.replace("custom:", "");
      const custom = customCategories.find((entry) => entry.id === customId);
      return custom?.name ?? "Eigene Kategorie";
    }
    return DOCUMENT_CATEGORIES[categoryKey as DocumentCategory]?.name ?? "Kategorie";
  };

  const handleToggleCategoryLock = async (e: React.MouseEvent, categoryKey: string) => {
    e.stopPropagation();

    if (securedCategoriesSupport === "unavailable") {
      toast({
        title: "Kategorie-Schutz nicht verfugbar",
        description:
          "Die Datenbankspalte secured_categories fehlt in dieser Umgebung.",
      });
      return;
    }

    const isCurrentlySecured = securedCategories.includes(categoryKey);
    if (isCurrentlySecured) {
      setDisableCategoryLockTarget(categoryKey);
      setDisableCategoryLockError(null);
      setIsDisableCategoryLockDialogOpen(true);
      return;
    }

    if (!hasRecentUnlock) {
      vaultContext.requestUnlock();
      return;
    }

    const newSecured = [...securedCategories, categoryKey];
    setSecuredCategories(newSecured);
    emit(EVENT_CATEGORY_LOCKED, {
      category_key: categoryKey,
    });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ secured_categories: newSecured })
          .eq("id", user.id);

        if (updateError) {
          setSecuredCategories((prev) => prev.filter((key) => key !== categoryKey));
          if (isSecuredCategoriesUnavailableError(updateError)) {
            setSecuredCategoriesSupport("unavailable");
            console.warn("secured_categories column is unavailable in this environment");
            toast({
              title: "Kategorie-Schutz nicht gespeichert",
              description:
                "Die Kategorie bleibt unverandert, weil secured_categories nicht verfugbar ist.",
            });
            return;
          }

          toast({
            title: "Kategorie-Schutz nicht gespeichert",
            description: "Bitte versuchen Sie es erneut.",
          });
        }
      }
    } catch (err) {
      setSecuredCategories((prev) => prev.filter((key) => key !== categoryKey));
      console.warn("Could not save secured_categories to profile", err);
      toast({
        title: "Kategorie-Schutz nicht gespeichert",
        description: "Bitte versuchen Sie es erneut.",
      });
    }
  };

  const handleConfirmDisableCategoryLock = async ({
    passphrase,
    mode,
  }: {
    passphrase: string;
    mode: DisableCategoryLockMode;
  }) => {
    if (!disableCategoryLockTarget) {
      return;
    }

    setIsDisablingCategoryLock(true);
    setDisableCategoryLockError(null);

    try {
      await vaultContext.unlock(passphrase);
    } catch {
      setDisableCategoryLockError("Passwort ist nicht korrekt.");
      setIsDisablingCategoryLock(false);
      return;
    }

    const nextSecuredCategories = securedCategories.filter(
      (key) => key !== disableCategoryLockTarget,
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setDisableCategoryLockError("Benutzer nicht gefunden.");
      setIsDisablingCategoryLock(false);
      return;
    }

    const { error: updateProfileError } = await supabase
      .from("profiles")
      .update({ secured_categories: nextSecuredCategories })
      .eq("id", user.id);

    if (updateProfileError) {
      if (isSecuredCategoriesUnavailableError(updateProfileError)) {
        setSecuredCategoriesSupport("unavailable");
        setDisableCategoryLockError(
          "Kategorie-Schutz ist in dieser Umgebung nicht verfugbar.",
        );
      } else {
        setDisableCategoryLockError("Kategorie-Schutz konnte nicht deaktiviert werden.");
      }
      setIsDisablingCategoryLock(false);
      return;
    }

    setSecuredCategories(nextSecuredCategories);
    emit(EVENT_CATEGORY_UNLOCKED, {
      category_key: disableCategoryLockTarget,
      mode,
    });

    if (mode === "unlock_all_docs") {
      const targetCategory = disableCategoryLockTarget;
      const targetDocumentIds = documents
        .filter((doc) => isDocInCategory(doc, targetCategory))
        .map((doc) => doc.id);

      if (targetDocumentIds.length > 0) {
        const { error: unlockDocsError } = await supabase
          .from("documents")
          .update({ extra_security_enabled: false })
          .in("id", targetDocumentIds);

        if (unlockDocsError) {
          setDisableCategoryLockError(
            "Kategorie-Schutz deaktiviert, aber Dokumente konnten nicht entsperrt werden.",
          );
          setIsDisablingCategoryLock(false);
          return;
        }

        setDocuments((prev) =>
          prev.map((doc) =>
            targetDocumentIds.includes(doc.id)
              ? { ...doc, extra_security_enabled: false }
              : doc,
          ),
        );
      }
    }

    setIsDisableCategoryLockDialogOpen(false);
    setDisableCategoryLockTarget(null);
    setDisableCategoryLockError(null);
    toast({
      title: "Kategorie-Schutz deaktiviert",
      description:
        mode === "unlock_all_docs"
          ? "Kategorie und Dokumente sind entsperrt."
          : "Kategorie ist entsperrt, Dokumente bleiben gesichert.",
    });
    setIsDisablingCategoryLock(false);
  };

  const handleToggleDocumentSecurity = async (
    event: { stopPropagation: () => void },
    documentId: string,
    enabled: boolean,
  ) => {
    event.stopPropagation();

    if (!hasRecentUnlock) {
      setRequiresRecentUnlock(true);
      setPendingUnlockDocumentId(documentId);
      vaultContext.requestUnlock();
      return;
    }

    emit(enabled ? EVENT_DOCUMENT_LOCKED : EVENT_DOCUMENT_UNLOCKED, {
      document_id: documentId,
    });

    setDocuments((prev) =>
      prev.map((doc) =>
        doc.id === documentId ? { ...doc, extra_security_enabled: enabled } : doc,
      ),
    );

    const { error } = await supabase
      .from("documents")
      .update({ extra_security_enabled: enabled })
      .eq("id", documentId);

    if (error) {
      setDocuments((prev) =>
        prev.map((doc) =>
          doc.id === documentId ? { ...doc, extra_security_enabled: !enabled } : doc,
        ),
      );
      const errorMessage = String(error.message ?? "");
      const missingColumnError =
        error.code === "42703" || errorMessage.includes("extra_security_enabled");
      toast({
        title: "Dokument-Sicherheit konnte nicht gespeichert werden",
        description: missingColumnError
          ? "Sicherheitsfunktion ist auf dem Server noch nicht vollständig aktiviert."
          : "Bitte versuchen Sie es erneut.",
      });
      return;
    }

    if (enabled) {
      toast({
        title: "Dokument gesperrt",
        description:
          "Zum Entsperren klicken Sie auf das Dokument und geben Ihr Tresor-Passwort ein (5 Minuten gültig).",
      });
      return;
    }

    toast({
      title: "Dokument entsperrt",
    });
  };

  const isCategoryLocked = (categoryKey: string) =>
    securedCategories.includes(categoryKey) && !vaultContext.isUnlocked;

  const handleCategoryClick = (categoryKey: string) => {
    const lockedByTime = isCategoryLocked(categoryKey);

    if (lockedByTime) {
      setPendingUnlockCategory(categoryKey);
      vaultContext.requestUnlock();
      return;
    }

    if (categoryKey.startsWith("custom:")) {
      const customId = categoryKey.replace("custom:", "");
      setActiveTab(`custom:${customId}`);
      setSelectedCustomCategory(customId);
      setSelectedCategory(null);
    } else {
      setActiveTab(categoryKey);
      setSelectedCategory(categoryKey as DocumentCategory);
      setSelectedCustomCategory(null);
    }

    setCurrentFolder(null);
  };

  const recentDocuments = useMemo(() => {
    return [...documents]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 3);
  }, [documents]);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = (await supabase
      .from("documents")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })) as {
      data: Document[] | null;
      error: Error | null;
    };

    if (!error && data) {
      setDocuments(data);
      const totalSize = data.reduce((sum, doc) => sum + doc.file_size, 0);
      setStorageUsed(totalSize);
    }
    setIsLoading(false);
  }, [supabase]);

  const fetchSubcategories = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("subcategories")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (!error && data) {
      setSubcategories(data as Subcategory[]);
    }
  }, [supabase]);

  const fetchCustomCategories = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("custom_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (!error && data) {
      setCustomCategories(data as CustomCategory[]);
    }
  }, [supabase]);

  const fetchFamilyMembers = useCallback(async () => {
    try {
      const trustedPersons = await loadShareEligibleTrustedPersons(supabase);
      setFamilyMembers(trustedPersons);
    } catch {
      setFamilyMembers([]);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDocuments();
    fetchSubcategories();
    fetchCustomCategories();
    fetchFamilyMembers();
  }, [
    fetchDocuments,
    fetchSubcategories,
    fetchCustomCategories,
    fetchFamilyMembers,
  ]);

  useEffect(() => {
    const categoryParam = searchParams.get("kategorie");
    const highlightParam = searchParams.get("highlight");
    const subcategoryParam = searchParams.get("unterordner");

    if (categoryParam === "overview" || categoryParam === "all") {
      setActiveTab(categoryParam);
      setSelectedCategory(null);
      setSelectedCustomCategory(null);
      setCurrentFolder(null);
    } else if (categoryParam) {
      const targetDoc = highlightParam
        ? documents.find((doc) => doc.id === highlightParam)
        : null;
      const targetCategoryKey =
        targetDoc?.custom_category_id
          ? `custom:${targetDoc.custom_category_id}`
          : categoryParam;
      const categoryIsLocked =
        securedCategories.includes(targetCategoryKey) && !vaultContext.isUnlocked;
      const documentNeedsUnlock = targetDoc ? isDocumentLocked(targetDoc) : false;

      if (categoryIsLocked || documentNeedsUnlock) {
        setPendingUnlockCategory(targetCategoryKey);
        setPendingUnlockDocumentId(targetDoc?.id ?? highlightParam ?? null);
        if (!isUnlockRequested) {
          vaultContext.requestUnlock();
        }
      } else if (targetCategoryKey.startsWith("custom:")) {
        const customId = targetCategoryKey.replace("custom:", "");
        setActiveTab(`custom:${customId}`);
        setSelectedCustomCategory(customId);
        setSelectedCategory(null);
        setCurrentFolder(null);
      } else {
        setActiveTab(targetCategoryKey);
        setSelectedCategory(targetCategoryKey as DocumentCategory);
        setSelectedCustomCategory(null);
        setCurrentFolder(null);
      }
    }
    if (subcategoryParam) {
      const folder = subcategories.find((entry) => entry.id === subcategoryParam);
      if (folder) {
        setCurrentFolder(folder);
      }
    }

    setHighlightedDoc(highlightParam);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Handle document highlighting from search
  useEffect(() => {
    if (highlightedDoc && documents.length > 0) {
      const targetDoc = documents.find((doc) => doc.id === highlightedDoc);
      if (targetDoc) {
        const targetCategoryKey = targetDoc.custom_category_id
          ? `custom:${targetDoc.custom_category_id}`
          : targetDoc.category;
        const categoryIsLocked =
          securedCategories.includes(targetCategoryKey) && !vaultContext.isUnlocked;
        if (categoryIsLocked || isDocumentLocked(targetDoc)) {
          setPendingUnlockCategory(targetCategoryKey);
          setPendingUnlockDocumentId(targetDoc.id);
          vaultContext.requestUnlock();
          return;
        }

        if (targetCategoryKey.startsWith("custom:")) {
          const customId = targetCategoryKey.replace("custom:", "");
          setActiveTab(`custom:${customId}`);
          setSelectedCustomCategory(customId);
          setSelectedCategory(null);
        } else {
          setActiveTab(targetCategoryKey);
          setSelectedCategory(targetCategoryKey as DocumentCategory);
          setSelectedCustomCategory(null);
        }

        if (targetDoc.subcategory_id) {
          const folder = subcategories.find(
            (entry) => entry.id === targetDoc.subcategory_id,
          );
          setCurrentFolder(folder ?? null);
        } else {
          setCurrentFolder(null);
        }
      }

      let pulseTimer: ReturnType<typeof setTimeout> | null = null;

      // Scroll to the highlighted document after a short delay
      const timer = setTimeout(() => {
        const element = document.getElementById(`document-${highlightedDoc}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.classList.add("highlight-pulse");
          pulseTimer = setTimeout(() => {
            element.classList.remove("highlight-pulse");
          }, 2500);
        }
      }, 500);

      // Clear highlight after 3 seconds
      const clearTimer = setTimeout(() => {
        setHighlightedDoc(null);
      }, 3000);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
        if (pulseTimer) {
          clearTimeout(pulseTimer);
        }
      };
    }
  }, [
    highlightedDoc,
    documents,
    isDocumentLocked,
    securedCategories,
    subcategories,
    vaultContext.isUnlocked,
    vaultContext,
  ]);

  const [decryptedTitles, setDecryptedTitles] = useState<
    Record<string, string>
  >({});
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewNotes, setPreviewNotes] = useState<string | null>(null);

  useEffect(() => {
    if (!auditLogDocumentId) {
      setAuditLogEntries([]);
      setAuditLogLoading(false);
      return;
    }

    let isMounted = true;

    const fetchAuditLog = async () => {
      setAuditLogLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) {
            setAuditLogEntries([]);
          }
          return;
        }

        const { data, error } = await supabase
          .from("security_audit_log")
          .select("id, event_type, timestamp, event_data")
          .eq("user_id", user.id)
          .in("event_type", [
            "document_viewed",
            "document_downloaded",
            "document_locked",
            "document_unlocked",
          ])
          .filter("event_data->>document_id", "eq", auditLogDocumentId)
          .order("timestamp", { ascending: false })
          .limit(50);

        if (error) {
          throw error;
        }

        if (isMounted) {
          setAuditLogEntries((data ?? []) as DocumentAuditEntry[]);
        }
      } catch {
        if (isMounted) {
          setAuditLogEntries([]);
        }
      } finally {
        if (isMounted) {
          setAuditLogLoading(false);
        }
      }
    };

    void fetchAuditLog();

    return () => {
      isMounted = false;
    };
  }, [auditLogDocumentId, supabase]);

  useEffect(() => {
    if (!vaultContext.isUnlocked || !vaultContext.masterKey) {
      setDecryptedTitles({});
      return;
    }
    const masterKey = vaultContext.masterKey;
    const entries: Record<string, string> = {};
    const decryptTitles = async () => {
      for (const doc of documents) {
        if (doc.is_encrypted && doc.wrapped_dek && doc.title_encrypted) {
          try {
            const dek = await unwrapKey(doc.wrapped_dek, masterKey, "AES-GCM");
            entries[doc.id] = await decryptField(doc.title_encrypted, dek);
          } catch {
            /* skip */
          }
        }
      }
      setDecryptedTitles(entries);
    };
    decryptTitles();
  }, [vaultContext.isUnlocked, vaultContext.masterKey, documents]);

  const validateAndSetFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setUploadError("Die Datei ist zu groß. Maximale Größe: 25 MB");
      return;
    }

    // Check storage limit based on user's tier
    const storageUsedMB = storageUsed / (1024 * 1024);
    const fileSizeMB = file.size / (1024 * 1024);
    const storageCheck = canUploadFile(userTier, storageUsedMB, fileSizeMB);

    if (!storageCheck.allowed) {
      setUploadError(storageCheck.reason || "Speicherlimit erreicht.");
      return;
    }

    // Check document count limit
    if (
      userTier.limits.maxDocuments !== -1 &&
      documents.length >= userTier.limits.maxDocuments
    ) {
      setUploadError(
        `Dokumentenlimit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxDocuments} Dokumente. Upgraden Sie für mehr Dokumente.`,
      );
      return;
    }

    setUploadFile(file);
    setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
    setUploadError(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSetFile(file);
  };

  const handleCreateSubcategory = async () => {
    if (!newSubcategoryName.trim() || !uploadCategory) return;

    // Check subcategory limit
    if (!canPerformAction(userTier, "addSubcategory", subcategories.length)) {
      setUploadError(
        `Unterordner-Limit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxSubcategories} Unterordner. Upgraden Sie für mehr.`,
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("subcategories")
      .insert({
        user_id: user.id,
        parent_category: uploadCategory,
        name: newSubcategoryName.trim(),
        icon: "folder",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        // unique violation
        setUploadError(
          "Ein Unterordner mit diesem Namen existiert bereits in dieser Kategorie.",
        );
      } else {
        setUploadError("Fehler beim Erstellen des Unterordners.");
      }
      return;
    }

    if (data) {
      setSubcategories((prev) => [...prev, data as Subcategory]);
      setUploadSubcategory(data.id);
      setNewSubcategoryName("");
      setIsCreatingSubcategory(false);
    }
  };

  // Create folder directly from grid (without opening upload dialog)
  const handleCreateFolderInGrid = async () => {
    if (!newSubcategoryName.trim() || !newFolderCategory) return;

    // Check subcategory limit
    if (!canPerformAction(userTier, "addSubcategory", subcategories.length)) {
      setUpgradeModalFeature("folder");
      setUpgradeModalOpen(true);
      setIsCreatingFolderInGrid(false);
      setNewFolderCategory(null);
      setNewSubcategoryName("");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("subcategories")
      .insert({
        user_id: user.id,
        parent_category: newFolderCategory,
        name: newSubcategoryName.trim(),
        icon: "folder",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        alert(
          "Ein Ordner mit diesem Namen existiert bereits in dieser Kategorie.",
        );
      } else {
        alert("Fehler beim Erstellen des Ordners.");
      }
      return;
    }

    if (data) {
      setSubcategories((prev) => [...prev, data as Subcategory]);
      setNewSubcategoryName("");
      setIsCreatingFolderInGrid(false);
      setNewFolderCategory(null);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadCategory || !uploadTitle.trim()) return;

    // Final client-side limit check before attempting upload
    if (
      userTier.limits.maxDocuments !== -1 &&
      documents.length >= userTier.limits.maxDocuments
    ) {
      setUploadError(
        `Dokumentenlimit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxDocuments} Dokumente. Upgraden Sie für mehr Dokumente.`,
      );
      return;
    }

    // Validate required metadata fields
    if (uploadCategory) {
      const metadataFields = CATEGORY_METADATA_FIELDS[uploadCategory];
      if (metadataFields) {
        const missingRequired = metadataFields
          .filter((f) => f.required && !uploadMetadata[f.key]?.trim())
          .map((f) => f.label);
        if (missingRequired.length > 0) {
          setUploadError(
            `Bitte füllen Sie folgende Pflichtfelder aus: ${missingRequired.join(", ")}`,
          );
          return;
        }
      }
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();

      if (vaultContext.isUnlocked && vaultContext.masterKey) {
        const { generateDEK, encryptFile, encryptField, wrapKey } =
          await import("@/lib/security/document-e2ee");
        const buffer = await uploadFile.arrayBuffer();
        const dek = await generateDEK();
        const { ciphertext, iv: file_iv } = await encryptFile(buffer, dek);
        const title_encrypted = await encryptField(
          uploadTitle.trim() || uploadFile.name,
          dek,
        );
        const file_name_encrypted = await encryptField(uploadFile.name, dek);
        const wrapped_dek = await wrapKey(dek, vaultContext.masterKey);
        formData.append(
          "file",
          new Blob([ciphertext], { type: "application/octet-stream" }),
          "encrypted",
        );
        // Keep human-readable fields for list/search UX while payload stays encrypted.
        formData.append("title", uploadTitle.trim() || uploadFile.name);
        formData.append("file_name", uploadFile.name);
        formData.append("is_encrypted", "true");
        formData.append("encryption_version", "e2ee-v1");
        formData.append("wrapped_dek", wrapped_dek);
        formData.append("file_iv", file_iv);
        formData.append("title_encrypted", title_encrypted);
        formData.append("file_name_encrypted", file_name_encrypted);
        formData.append(
          "file_type",
          uploadFile.type || "application/octet-stream",
        );
        if (uploadNotes) {
          formData.append(
            "notes_encrypted",
            await encryptField(uploadNotes, dek),
          );
        }
      } else {
        // Zero-plaintext guarantee: uploads must always be encrypted.
        // If the vault is not unlocked at this point, the UploadDialog UI gate
        // (SubmitLocked / SubmitNotSetup) should have prevented reaching here.
        // If we somehow arrive here anyway, abort — never upload unencrypted content.
        throw new Error(
          "Tresor nicht entsperrt. Bitte entsperren Sie Ihren Tresor, bevor Sie ein Dokument hochladen.",
        );
      }

      formData.append("path", uploadCategory || "sonstige");
      formData.append("category", uploadCategory || "sonstige");

      if (uploadSubcategory) {
        formData.append("subcategory_id", uploadSubcategory);
      }

      if (uploadCustomCategory) {
        formData.append("custom_category_id", uploadCustomCategory);
      }

      if (uploadExpiryDate) {
        formData.append("expiry_date", uploadExpiryDate);
      }

      if (uploadCustomReminderDays !== null) {
        formData.append(
          "custom_reminder_days",
          uploadCustomReminderDays.toString(),
        );
      }

      if (uploadReminderWatcher) {
        formData.append("reminder_watcher_id", uploadReminderWatcher);
      }

      // Send metadata as JSON if any non-empty values exist
      const filteredMetadata = Object.fromEntries(
        Object.entries(uploadMetadata).filter(([, v]) => v && v.trim()),
      );
      if (Object.keys(filteredMetadata).length > 0) {
        formData.append("metadata", JSON.stringify(filteredMetadata));
      }
      formData.append("tags", JSON.stringify(uploadTags));

      const uploadRes = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        const retryAfter =
          typeof errorData.retryAfterSeconds === "number"
            ? errorData.retryAfterSeconds
            : null;
        const error = new Error(errorData.error || "Upload fehlgeschlagen") as
          | (Error & { status?: number; retryAfterSeconds?: number })
          | Error;
        (error as Error & { status?: number; retryAfterSeconds?: number }).status =
          uploadRes.status;
        (
          error as Error & { status?: number; retryAfterSeconds?: number }
        ).retryAfterSeconds = retryAfter;
        throw error;
      }

      const uploadData = await uploadRes.json();
      const { size: fileSize, document: insertedDoc } = uploadData;

      // Send notification to reminder watcher if selected
      if (uploadReminderWatcher && uploadExpiryDate && insertedDoc) {
        const watcher = familyMembers.find(
          (m) => m.id === uploadReminderWatcher,
        );
        if (watcher) {
          try {
            await fetch("/api/reminder-watcher/notify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                documentId: insertedDoc.id,
                documentTitle: uploadTitle,
                category: uploadCategory,
                expiryDate: uploadExpiryDate,
                watcherEmail: watcher.email,
                watcherName: watcher.name,
              }),
            });
          } catch (err) {
            console.error("Failed to notify watcher:", err);
          }
        }
      }

      // No need to update profiles storage manually - API handled it.
      // But we should update local state to reflect new usage immediately
      setStorageUsed((prev) => prev + fileSize);

      // Optimistic UI Update: Add document to list immediately
      // We need to fetch the subcategory/category details if needed for full display,
      // but simpler is to use what we have and let fetchDocuments catch up.
      // Or just insert it with basic data.
      if (insertedDoc) {
        const optimisticDoc: any = {
          ...insertedDoc,
          subcategory: { name: "Lade..." }, // Placeholder until refetch
          custom_category: null,
        };
        setDocuments((prev) => [optimisticDoc, ...prev]);
      }

      // Track successful upload
      capture(ANALYTICS_EVENTS.DOCUMENT_UPLOADED, {
        category: uploadCategory,
        has_subcategory: !!uploadSubcategory,
        file_type: uploadFile.type,
        file_size_kb: Math.round(fileSize / 1024),
      });

      const uploadedTitle = uploadTitle.trim() || uploadFile.name;

      // Reset and refresh
      setUploadFile(null);
      setUploadTitle("");
      setUploadNotes("");
      setUploadExpiryDate("");
      setUploadCustomReminderDays(null);
      setUploadSubcategory(null);
      setUploadCustomCategory(null);
      setUploadReminderWatcher(null);
      setUploadMetadata({});
      setUploadTags([]);
      setLockAfterUpload(false);
      setIsUploadOpen(false);

      let lockSucceeded = false;
      let lockFailed = false;
      if (lockAfterUpload && insertedDoc) {
        const { error: lockError } = await supabase
          .from("documents")
          .update({ extra_security_enabled: true })
          .eq("id", insertedDoc.id);
        if (lockError) {
          lockFailed = true;
        } else {
          lockSucceeded = true;
          setDocuments((prev) =>
            prev.map((doc) =>
              doc.id === insertedDoc.id
                ? { ...doc, extra_security_enabled: true }
                : doc,
            ),
          );
        }
      }

      if (lockFailed) {
        toast({
          title: "⚠️ Automatisches Sperren fehlgeschlagen",
          description:
            'Das Dokument wurde hochgeladen, aber nicht gesperrt. Verwenden Sie "🔒 Sperren".',
          duration: 7000,
        });
      }

      toast({
        title: `✅ "${uploadedTitle}" hochgeladen`,
        duration: 6000,
        actions: insertedDoc
          ? [
              ...(lockSucceeded
            ? [{ label: "🔒 Gesperrt" }]
            : [
                {
                  label: "🔒 Sperren",
                  onClick: async () => {
                    await handleToggleDocumentSecurity(
                      { stopPropagation: () => {} },
                      insertedDoc.id,
                      true,
                    );
                    toast({
                      title: "🔒 Dokument gesperrt",
                      duration: 3000,
                    });
                  },
                },
              ]),
              {
                label: "Ansehen",
                onClick: () => {
                  navigateToDocument(insertedDoc);
                },
              },
            ]
          : undefined,
      });

      // Fetch in background to ensure consistency
      fetchDocuments();
      // Share new encrypted doc with all trusted persons who have relationship keys
      if (
        vaultContext.isUnlocked &&
        vaultContext.masterKey &&
        insertedDoc?.is_encrypted
      ) {
        try {
          const { unwrapKey, wrapKey } =
            await import("@/lib/security/document-e2ee");
          const { data: rkRows } = await supabase
            .from("document_relationship_keys")
            .select("trusted_person_id, wrapped_rk")
            .eq("owner_id", (await supabase.auth.getUser()).data.user!.id);

          if (rkRows && rkRows.length > 0) {
            const dek = await unwrapKey(
              insertedDoc.wrapped_dek!,
              vaultContext.masterKey,
              "AES-GCM",
            );
            for (const row of rkRows) {
              try {
                const rkKey = await unwrapKey(
                  row.wrapped_rk,
                  vaultContext.masterKey,
                  "AES-KW",
                );
                const wrapped_dek_for_tp = await wrapKey(dek, rkKey);
                await fetch("/api/documents/share-token", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    documentId: insertedDoc.id,
                    trustedPersonId: row.trusted_person_id,
                    wrapped_dek_for_tp,
                  }),
                });
              } catch {
                // Non-fatal — TP can request new link
              }
            }
          }
        } catch {
          // Non-fatal
        }
      }
    } catch (error: any) {
      capture(ANALYTICS_EVENTS.ERROR_OCCURRED, {
        error_type: "document_upload_failed",
        category: uploadCategory,
      });
      // Check for document limit error from server
      const errorObj = error as {
        message?: string;
        code?: string;
        status?: number;
        retryAfterSeconds?: number;
      };
      if (
        errorObj?.message?.includes("Document limit") ||
        errorObj?.code === "check_violation"
      ) {
        setUploadError(
          "Dokumentenlimit erreicht. Bitte upgraden Sie für mehr Dokumente.",
        );
        setUpgradeModalFeature("document");
        setUpgradeModalOpen(true);
      } else if (errorObj?.message?.includes("Tresor nicht entsperrt")) {
        // Surface the vault-not-unlocked error directly
        setUploadError(errorObj.message ?? "Tresor nicht entsperrt.");
      } else if (errorObj?.status === 429) {
        const waitSeconds =
          typeof errorObj.retryAfterSeconds === "number"
            ? errorObj.retryAfterSeconds
            : null;
        setUploadError(
          waitSeconds && waitSeconds > 0
            ? `Zu viele Upload-Versuche. Bitte warten Sie ${waitSeconds} Sekunden und versuchen Sie es erneut.`
            : "Zu viele Upload-Versuche. Bitte kurz warten und erneut versuchen.",
        );
      } else {
        setUploadError("Fehler beim Hochladen. Bitte versuchen Sie es erneut.");
      }
      console.error("Upload error:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm("Möchten Sie dieses Dokument wirklich löschen?")) return;

    try {
      // Delete from storage
      await supabase.storage.from("documents").remove([doc.file_path]);

      // Delete record
      await supabase.from("documents").delete().eq("id", doc.id);

      // Update storage
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({ storage_used: Math.max(0, storageUsed - doc.file_size) })
          .eq("id", user.id);
      }

      fetchDocuments();
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const assertEncryptionVersionSupported = (doc: Document) => {
    if (!doc.is_encrypted) return;
    const version = doc.encryption_version || "e2ee-v1";
    if (version !== "e2ee-v1") {
      throw new Error("Nicht unterstützte Verschlüsselungsversion");
    }
  };

  const handleDownload = async (doc: Document) => {
    if (isDocumentLocked(doc)) {
      setPendingUnlockDocumentId(doc.id);
      vaultContext.requestUnlock();
      return;
    }

    if (doc.is_encrypted) {
      assertEncryptionVersionSupported(doc);
      if (!vaultContext.masterKey) {
        setPendingUnlockDocumentId(doc.id);
        vaultContext.requestUnlock();
        return;
      }
      try {
        const { data } = await supabase.storage
          .from("documents")
          .download(doc.file_path);
        if (!data) throw new Error("Download fehlgeschlagen");
        const buffer = await data.arrayBuffer();
        const { unwrapKey: uw, decryptFile } =
          await import("@/lib/security/document-e2ee");
        const dek = await uw(
          doc.wrapped_dek!,
          vaultContext.masterKey,
          "AES-GCM",
        );
        const plain = await decryptFile(buffer, dek, doc.file_iv!);
        const blob = new Blob([plain], {
          type: doc.file_type || "application/octet-stream",
        });
        const url = URL.createObjectURL(blob);
        const a = window.document.createElement("a");
        a.href = url;
        let downloadName = doc.file_name || "dokument";
        if (doc.file_name_encrypted) {
          try {
            const { decryptField: df2 } =
              await import("@/lib/security/document-e2ee");
            downloadName = await df2(doc.file_name_encrypted, dek);
          } catch {
            /* fallback to placeholder */
          }
        }
        a.download = downloadName;

        window.document.body.appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        window.document.body.removeChild(a);
        emit(EVENT_DOCUMENT_DOWNLOADED, {
          document_id: doc.id,
          document_title: doc.title ?? "Unbekannt",
        });
      } catch {
        alert("Fehler beim Herunterladen des Dokuments");
      }
      return;
    }
    const { data } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);
    if (data?.signedUrl) {
      const openedWindow = window.open(data.signedUrl, "_blank");
      if (openedWindow) {
        emit(EVENT_DOCUMENT_DOWNLOADED, {
          document_id: doc.id,
          document_title: doc.title ?? "Unbekannt",
        });
      }
    }
  };

  const handleOpenDocument = async (doc: Document) => {
    if (isDocumentLocked(doc)) {
      setPendingUnlockDocumentId(doc.id);
      vaultContext.requestUnlock();
      return;
    }

    if (!doc.is_encrypted) {
      setPreviewBlob(null);
      setPreviewNotes(null);
      setPreviewDocument(doc);
      emit(EVENT_DOCUMENT_VIEWED, {
        document_id: doc.id,
        document_title: doc.title ?? "Unbekannt",
      });
      return;
    }
    assertEncryptionVersionSupported(doc);
    if (!vaultContext.masterKey) {
      setPendingUnlockDocumentId(doc.id);
      vaultContext.requestUnlock();
      return;
    }
    try {
      const { data } = await supabase.storage
        .from("documents")
        .download(doc.file_path);
      if (!data) throw new Error("Download fehlgeschlagen");
      const buffer = await data.arrayBuffer();
      const {
        unwrapKey: uw,
        decryptFile,
        decryptField: df,
      } = await import("@/lib/security/document-e2ee");
      const dek = await uw(doc.wrapped_dek!, vaultContext.masterKey, "AES-GCM");
      const plain = await decryptFile(buffer, dek, doc.file_iv!);
      setPreviewBlob(
        new Blob([plain], {
          type: doc.file_type || "application/octet-stream",
        }),
      );
      setPreviewNotes(
        doc.notes_encrypted
          ? await df(doc.notes_encrypted, dek).catch(() => null)
          : null,
      );
      setPreviewDocument(doc);
      emit(EVENT_DOCUMENT_VIEWED, {
        document_id: doc.id,
        document_title: doc.title ?? "Unbekannt",
      });
    } catch {
      alert("Fehler beim Öffnen des Dokuments");
    }
  };

  // Selection handlers
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocuments((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const selectAllInCategory = (category: DocumentCategory) => {
    const categoryDocs = documents.filter((d) => d.category === category);
    setSelectedDocuments(new Set(categoryDocs.map((d) => d.id)));
  };

  const clearPendingBulkSecurityAction = useCallback(() => {
    setPendingBulkSecurityAction(null);
    setPendingBulkSecuritySelectionIds(null);
    setIsAwaitingBulkSecurityUnlock(false);
  }, []);

  const clearSelection = () => {
    setSelectedDocuments(new Set());
    clearPendingBulkSecurityAction();
  };

  const applyBulkDocumentSecurity = useCallback(
    async (enabled: boolean, targetDocumentIds?: string[]) => {
      const docIds = targetDocumentIds ?? Array.from(selectedDocuments);
      if (docIds.length === 0) return;

      setIsApplyingBulkSecurity(true);

      try {
        const results = await Promise.all(
          docIds.map(async (docId) => {
            const { error } = await supabase
              .from("documents")
              .update({ extra_security_enabled: enabled })
              .eq("id", docId);
            return { docId, ok: !error };
          }),
        );

        const successfulIds = new Set(
          results.filter((result) => result.ok).map((result) => result.docId),
        );
        const successCount = successfulIds.size;
        const failureCount = docIds.length - successCount;

        if (successCount > 0) {
          setDocuments((prev) =>
            prev.map((doc) =>
              successfulIds.has(doc.id)
                ? { ...doc, extra_security_enabled: enabled }
                : doc,
            ),
          );
          toast({
            title: `${successCount} Dokumente ${enabled ? "gesperrt" : "entsperrt"}`,
          });
        }

        if (failureCount > 0) {
          toast({
            title: "Teilweise fehlgeschlagen",
            description: `${failureCount} Dokumente konnten nicht aktualisiert werden.`,
          });
        }
      } finally {
        setIsApplyingBulkSecurity(false);
      }
    },
    [selectedDocuments, supabase],
  );

  useEffect(() => {
    if (
      !pendingBulkSecurityAction ||
      !pendingBulkSecuritySelectionIds ||
      pendingBulkSecuritySelectionIds.length === 0 ||
      !hasRecentUnlock
    ) {
      return;
    }

    const shouldEnable = pendingBulkSecurityAction === "lock";
    const deferredDocIds = pendingBulkSecuritySelectionIds;
    clearPendingBulkSecurityAction();
    setRequiresRecentUnlock(false);
    void applyBulkDocumentSecurity(shouldEnable, deferredDocIds);
  }, [
    applyBulkDocumentSecurity,
    clearPendingBulkSecurityAction,
    hasRecentUnlock,
    pendingBulkSecurityAction,
    pendingBulkSecuritySelectionIds,
  ]);

  useEffect(() => {
    if (!isAwaitingBulkSecurityUnlock) {
      return;
    }

    if (!pendingBulkSecurityAction || !pendingBulkSecuritySelectionIds) {
      setIsAwaitingBulkSecurityUnlock(false);
      return;
    }

    if (hasRecentUnlock || isUnlockRequested) {
      return;
    }

    clearPendingBulkSecurityAction();
    setRequiresRecentUnlock(false);
  }, [
    clearPendingBulkSecurityAction,
    hasRecentUnlock,
    isAwaitingBulkSecurityUnlock,
    isUnlockRequested,
    pendingBulkSecurityAction,
    pendingBulkSecuritySelectionIds,
  ]);

  // Navigate to document logic
  const navigateToDocument = (doc: Document) => {
    const targetCategoryKey = doc.custom_category_id
      ? `custom:${doc.custom_category_id}`
      : doc.category;

    if (isCategoryLocked(targetCategoryKey) || isDocumentLocked(doc)) {
      setPendingUnlockCategory(targetCategoryKey);
      setPendingUnlockDocumentId(doc.id);
      vaultContext.requestUnlock();
      return;
    }

    // 1. Determine tab and category
    if (doc.custom_category_id) {
      setActiveTab(`custom:${doc.custom_category_id}`);
      setSelectedCustomCategory(doc.custom_category_id);
      setSelectedCategory(null);
    } else {
      setActiveTab(doc.category);
      setSelectedCategory(doc.category);
      setSelectedCustomCategory(null);
    }

    // 2. Open folder if document is in one
    if (doc.subcategory_id) {
      const folder = subcategories.find((s) => s.id === doc.subcategory_id);
      if (folder) {
        setCurrentFolder(folder);
      }
    } else {
      setCurrentFolder(null);
    }

    // 3. Highlight and scroll
    setHighlightedDoc(doc.id);
    setTimeout(() => {
      const element = document.getElementById(`document-${doc.id}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);

    void handleOpenDocument(doc);
  };

  // Move handlers
  const openMoveDialog = (docIds?: string[]) => {
    if (docIds) {
      setSelectedDocuments(new Set(docIds));
    }
    setMoveTargetFolder(null);
    setIsCreatingFolderInMove(false);
    setNewFolderNameInMove("");
    setIsMoveDialogOpen(true);
  };

  const handleMoveDocuments = async () => {
    if (selectedDocuments.size === 0) return;

    setIsMoving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // If creating new folder first
      let targetFolderId = moveTargetFolder;
      if (isCreatingFolderInMove && newFolderNameInMove.trim()) {
        // Get category from first selected document
        const firstDocId = Array.from(selectedDocuments)[0];
        const firstDoc = documents.find((d) => d.id === firstDocId);
        if (!firstDoc) return;

        const { data: newFolder, error: folderError } = await supabase
          .from("subcategories")
          .insert({
            user_id: user.id,
            parent_category: firstDoc.category,
            name: newFolderNameInMove.trim(),
            icon: "folder",
          })
          .select()
          .single();

        if (folderError) {
          alert("Fehler beim Erstellen des Ordners: " + folderError.message);
          setIsMoving(false);
          return;
        }

        targetFolderId = newFolder.id;
        setSubcategories((prev) => [...prev, newFolder as Subcategory]);
      }

      // Move all selected documents
      const docIds = Array.from(selectedDocuments);
      const { error } = await supabase
        .from("documents")
        .update({ subcategory_id: targetFolderId })
        .in("id", docIds);

      if (error) {
        alert("Fehler beim Verschieben: " + error.message);
      } else {
        // Update local state
        setDocuments((prev) =>
          prev.map((doc) =>
            selectedDocuments.has(doc.id)
              ? { ...doc, subcategory_id: targetFolderId }
              : doc,
          ),
        );
        setIsMoveDialogOpen(false);
        clearSelection();
      }
    } catch (error) {
      console.error("Move error:", error);
      alert("Fehler beim Verschieben der Dokumente");
    } finally {
      setIsMoving(false);
    }
  };

  // Get available folders for move (same category as selected docs)
  const getAvailableFoldersForMove = () => {
    if (selectedDocuments.size === 0) return [];
    const firstDocId = Array.from(selectedDocuments)[0];
    const firstDoc = documents.find((d) => d.id === firstDocId);
    if (!firstDoc) return [];
    return subcategories.filter((s) => s.parent_category === firstDoc.category);
  };

  // Delete folder handler
  const handleDeleteFolder = async (
    folder: Subcategory,
    e?: React.MouseEvent,
  ) => {
    if (e) e.stopPropagation(); // Prevent folder click

    const docsInFolder = documents.filter(
      (d) => d.subcategory_id === folder.id,
    );
    const confirmMessage =
      docsInFolder.length > 0
        ? `Ordner "${folder.name}" mit ${docsInFolder.length} Dokument(en) löschen? Die Dokumente werden nicht gelöscht, sondern nur aus dem Ordner entfernt.`
        : `Ordner "${folder.name}" wirklich löschen?`;

    if (!confirm(confirmMessage)) return;

    try {
      // First, remove folder reference from all documents in this folder
      if (docsInFolder.length > 0) {
        const { error: updateError } = await supabase
          .from("documents")
          .update({ subcategory_id: null })
          .eq("subcategory_id", folder.id);

        if (updateError) {
          alert("Fehler beim Entfernen der Dokumente aus dem Ordner.");
          return;
        }

        // Update local documents state
        setDocuments((prev) =>
          prev.map((doc) =>
            doc.subcategory_id === folder.id
              ? { ...doc, subcategory_id: null }
              : doc,
          ),
        );
      }

      // Delete the folder
      const { error: deleteError } = await supabase
        .from("subcategories")
        .delete()
        .eq("id", folder.id);

      if (deleteError) {
        alert("Fehler beim Löschen des Ordners.");
        return;
      }

      // Update local state
      setSubcategories((prev) => prev.filter((s) => s.id !== folder.id));

      // If we were viewing this folder, go back
      if (currentFolder?.id === folder.id) {
        setCurrentFolder(null);
      }
    } catch (error) {
      console.error("Delete folder error:", error);
      alert("Fehler beim Löschen des Ordners.");
    }
  };

  const openUploadDialog = (
    category: DocumentCategory | null,
    customCategoryId?: string,
  ) => {
    setUploadCategory(category);
    setUploadCustomCategory(customCategoryId || null);
    setUploadSubcategory(null);
    setUploadMetadata({});
    setIsCreatingSubcategory(false);
    setNewSubcategoryName("");
    setIsUploadOpen(true);
  };

  const handleCloseUpload = () => {
    setUploadTags([]);
    setLockAfterUpload(false);
    setIsUploadOpen(false);
  };

  // Custom category handlers
  const openCategoryDialog = (category?: CustomCategory) => {
    if (
      !category &&
      !canPerformAction(userTier, "addCustomCategory", customCategories.length)
    ) {
      setUpgradeModalFeature("custom_category");
      setUpgradeModalOpen(true);
      return;
    }

    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || "",
        icon: category.icon ? toPascalCase(category.icon) : "Folder",
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", icon: "Folder" });
    }
    setCategoryIconSearch("");
    setCategoryError(null);
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      setCategoryError("Bitte geben Sie einen Namen ein.");
      return;
    }

    setIsSavingCategory(true);
    setCategoryError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      if (editingCategory) {
        // Update existing
        const { error } = await supabase
          .from("custom_categories")
          .update({
            name: categoryForm.name.trim(),
            description: categoryForm.description.trim() || null,
            icon: categoryForm.icon || "Folder",
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
      } else {
        // Check limit
        if (
          !canPerformAction(
            userTier,
            "addCustomCategory",
            customCategories.length,
          )
        ) {
          setCategoryError(
            `Kategorie-Limit erreicht. Ihr Plan erlaubt maximal ${userTier.limits.maxCustomCategories} eigene Kategorien.`,
          );
          setIsSavingCategory(false);
          return;
        }

        // Create new
        const { error } = await supabase.from("custom_categories").insert({
          user_id: user.id,
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim() || null,
          icon: categoryForm.icon || "Folder",
        });

        if (error) {
          if (error.code === "23505") {
            setCategoryError(
              "Eine Kategorie mit diesem Namen existiert bereits.",
            );
          } else {
            throw error;
          }
          setIsSavingCategory(false);
          return;
        }
      }

      setIsCategoryDialogOpen(false);
      fetchCustomCategories();
    } catch (error) {
      console.error("Save category error:", error);
      setCategoryError("Fehler beim Speichern. Bitte versuchen Sie es erneut.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const docsInCategory = documents.filter(
      (d) => d.custom_category_id === categoryId,
    );
    const confirmMessage =
      docsInCategory.length > 0
        ? `Diese Kategorie mit ${docsInCategory.length} Dokument(en) löschen? Die Dokumente werden in "Sonstige" verschoben.`
        : "Diese Kategorie wirklich löschen?";

    if (!confirm(confirmMessage)) return;

    try {
      // Move documents to "sonstige" category
      if (docsInCategory.length > 0) {
        await supabase
          .from("documents")
          .update({
            custom_category_id: null,
            category: "sonstige" as DocumentCategory,
          })
          .eq("custom_category_id", categoryId);
      }

      const { error } = await supabase
        .from("custom_categories")
        .delete()
        .eq("id", categoryId);

      if (error) throw error;

      // Reset selection if deleted category was selected
      if (selectedCustomCategory === categoryId) {
        setSelectedCustomCategory(null);
        setSelectedCategory(null);
      }

      fetchCustomCategories();
      fetchDocuments();
    } catch (error) {
      console.error("Delete category error:", error);
      alert("Fehler beim Löschen der Kategorie.");
    }
  };

  const toggleSubcategoryExpand = (subcategoryId: string) => {
    setExpandedSubcategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subcategoryId)) {
        newSet.delete(subcategoryId);
      } else {
        newSet.add(subcategoryId);
      }
      return newSet;
    });
  };

  // Pre-process documents for validation and deduplication (as per random_empty_documents.md)
  const validatedDocuments = (() => {
    const seenIds = new Set();
    return documents.filter((doc) => {
      // 1. Mandatory title validation
      if (!doc.title || doc.title.trim().length === 0) return false;
      // 2. ID deduplication
      if (seenIds.has(doc.id)) return false;
      seenIds.add(doc.id);
      return true;
    });
  })();

  const availableTags = useMemo(
    () => [...new Set(documents.flatMap((d) => d.tags ?? []))].sort(),
    [documents],
  );

  const tagCounts = (() => {
    const counts = new Map<string, number>();
    const docsForTagCount = validatedDocuments.filter((doc) => {
      if (selectedCustomCategory) return doc.custom_category_id === selectedCustomCategory;
      const matchesCategory = !selectedCategory || doc.category === selectedCategory;
      const notInCustomCategory = !doc.custom_category_id;
      return matchesCategory && (selectedCategory ? notInCustomCategory : true);
    });
    docsForTagCount.forEach((doc) => {
      (doc.tags ?? []).forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });
    return counts;
  })();

  function updateTagFilters(
    next:
      | Set<string>
      | ((prev: Set<string>) => Set<string>),
  ) {
    setActiveTagFilters((prev) => {
      const nextFilters = next instanceof Function ? next(prev) : next;
      const params = new URLSearchParams(searchParams.toString());
      if (nextFilters.size > 0) {
        params.set("tags", [...nextFilters].join(","));
      } else {
        params.delete("tags");
      }
      const nextQuery = params.toString();
      const currentQuery = searchParams.toString();
      if (nextQuery !== currentQuery) {
        router.replace(nextQuery ? `?${nextQuery}` : "?", { scroll: false });
      }
      return nextFilters;
    });
  }

  const filteredDocuments = validatedDocuments
    .filter((doc) => {
      if (selectedCustomCategory) {
        const matchesCustomCategory =
          doc.custom_category_id === selectedCustomCategory;
        return matchesCustomCategory;
      }

      const matchesCategory =
        !selectedCategory || doc.category === selectedCategory;
      const notInCustomCategory = !doc.custom_category_id;
      return (
        matchesCategory &&
        (selectedCategory ? notInCustomCategory : true)
      );
    })
    .filter(
      (doc) =>
        activeTagFilters.size === 0 ||
        (doc.tags ?? []).some((t) => activeTagFilters.has(t)),
    );

  const getDocumentCountForCategory = (category: DocumentCategory) => {
    return validatedDocuments.filter(
      (d) => d.category === category && !d.custom_category_id,
    ).length;
  };

  const getDocumentCountForCustomCategory = (categoryId: string) => {
    return validatedDocuments.filter((d) => d.custom_category_id === categoryId)
      .length;
  };

  const getSubcategoriesForCategory = (category: DocumentCategory) => {
    return subcategories.filter((s) => s.parent_category === category);
  };

  const getDocumentsForSubcategory = (subcategoryId: string) => {
    return filteredDocuments.filter((d) => d.subcategory_id === subcategoryId);
  };

  const getUncategorizedDocuments = (category: DocumentCategory) => {
    return filteredDocuments.filter(
      (d) => d.category === category && !d.subcategory_id,
    );
  };

  const getDisplayTitle = (doc: Document) => {
    if (
      privacyModeEnabled &&
      (isCategoryLocked(
        doc.custom_category_id ? `custom:${doc.custom_category_id}` : doc.category,
      ) ||
        isDocumentLocked(doc))
    ) {
      return "Titel verborgen";
    }
    // When vault is locked and doc is encrypted, keep plaintext title visible.
    if (doc.extra_security_enabled && !vaultContext.isUnlocked && !privacyModeEnabled) {
      return doc.title;
    }
    return decryptedTitles[doc.id] ?? doc.title;
  };

  const getCategorySubcategoriesForUpload = () => {
    if (!uploadCategory) return [];
    return subcategories.filter((s) => s.parent_category === uploadCategory);
  };

  // Render document item
  const renderDocumentItem = (doc: Document) => {
    const category = DOCUMENT_CATEGORIES[doc.category];
    const Icon = iconMap[category.icon] || FileText;
    const subcategory = doc.subcategory_id
      ? subcategories.find((s) => s.id === doc.subcategory_id)
      : null;
    const isSelected = selectedDocuments.has(doc.id);
    const isHighlighted = highlightedDoc === doc.id;
    const isExtraSecured = Boolean(doc.extra_security_enabled);
    const isLocked = isDocumentLocked(doc);

    return (
      <div
        key={doc.id}
        id={`document-${doc.id}`}
        data-testid={`document-row-${doc.id}`}
        onClick={() => navigateToDocument(doc)}
        className={`document-item flex items-center gap-3 p-3 rounded-xl border border-warmgray-200 dark:border-warmgray-800 group transition-all duration-300 cursor-pointer ${
          isHighlighted
            ? "border-sage-600 highlight-pulse"
            : isSelected
              ? "bg-sage-50 border-sage-300"
              : "bg-white dark:bg-warmgray-900 hover:border-sage-200 hover:bg-sage-50/30"
        }`}
      >
        {/* Checkbox */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleDocumentSelection(doc.id);
          }}
          aria-label={`Dokument ${getDisplayTitle(doc)} auswählen`}
          data-testid={`document-select-${doc.id}`}
          className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected
              ? "bg-sage-500 border-sage-500 text-white"
              : "border-warmgray-300 hover:border-sage-400"
          }`}
        >
          {isSelected && <Check className="w-4 h-4" />}
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-sage-50 dark:bg-sage-900/30 flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 text-sage-600 dark:text-sage-400" />
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="font-medium text-warmgray-900 truncate leading-tight">
              {getDisplayTitle(doc)}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-warmgray-500 mt-0.5">
              <span className="truncate">{category.name}</span>
              {subcategory && (
                <>
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{subcategory.name}</span>
                </>
              )}
              {doc.metadata && Object.keys(doc.metadata).length > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 text-xs text-sage-600 bg-sage-50 px-1.5 py-0.5 rounded-full flex-shrink-0"
                  title={`Zusätzliche Angaben: ${Object.keys(doc.metadata).length}`}
                >
                  <Info className="w-3 h-3" />
                </span>
              )}
              <span className="flex-shrink-0">•</span>
              <span className="flex-shrink-0">
                {formatFileSize(doc.file_size)}
              </span>
              <span className="flex-shrink-0 hidden xs:inline">•</span>
              <span className="flex-shrink-0 hidden xs:inline" suppressHydrationWarning>
                {formatDate(doc.created_at)}
              </span>
              {isExtraSecured ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
                  <ShieldCheck className="h-3 w-3" />
                  {isLocked ? "Gesperrt" : "Gesichert"}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div
          className="flex items-center gap-1 flex-shrink-0 ml-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 text-warmgray-400 !p-0 flex-shrink-0"
                aria-label={`Aktionen für ${getDisplayTitle(doc)}`}
                data-testid={`document-actions-${doc.id}`}
              >
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleOpenDocument(doc)}
                className="py-3"
              >
                <Eye className="w-4 h-4 mr-2" />
                Ansehen
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDownload(doc)}
                className="py-3"
              >
                <Download className="w-4 h-4 mr-2" />
                Herunterladen
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openMoveDialog([doc.id])}
                className="py-3"
              >
                <MoveRight className="w-4 h-4 mr-2" />
                Verschieben
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { setShareDocument(doc); setIsShareDialogOpen(true); }}
                className="py-3"
              >
                <Share2 className="w-4 h-4 mr-2" />
                Teilen
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(event) =>
                  void handleToggleDocumentSecurity(event, doc.id, !isExtraSecured)
                }
                className="py-3"
              >
                {isExtraSecured ? (
                  <ShieldOff className="w-4 h-4 mr-2" />
                ) : (
                  <Shield className="w-4 h-4 mr-2" />
                )}
                {isExtraSecured
                  ? "Extra-Sicherheit entfernen"
                  : "Extra-Sicherheit aktivieren"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setNotesEditorDoc(doc)}
                className="py-3"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Notiz bearbeiten
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setAuditLogDocumentId(doc.id);
                  setAuditLogDocumentTitle(doc.title ?? "Unbekannt");
                }}
                className="py-3"
              >
                <History className="w-4 h-4 mr-2" />
                Zugriffsprotokoll
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => handleDelete(doc)}
                className="text-red-600 py-3"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    );
  };

  // Render folder grid for a category (shows all subcategories as folders)
  const renderFolderGrid = (category: DocumentCategory) => {
    const categorySubcategories = getSubcategoriesForCategory(category);
    const uncategorizedDocs = getUncategorizedDocuments(category);
    const categoryInfo = DOCUMENT_CATEGORIES[category];
    const categoryKey = category;
    const isSecured = securedCategories.includes(categoryKey);

    return (
      <div className="space-y-6">
        {/* Action bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-medium text-warmgray-600">Unterordner</h3>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {seniorMode ? (
              <Button
                variant={isSecured ? "default" : "outline"}
                className="w-full sm:w-auto"
                onClick={(event) => void handleToggleCategoryLock(event, categoryKey)}
                disabled={securedCategoriesSupport === "unavailable"}
              >
                {isSecured ? (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                ) : (
                  <Shield className="mr-2 h-4 w-4" />
                )}
                {isSecured
                  ? "Extra-Sicherheit aktiv"
                  : "Extra-Sicherheit aktivieren"}
              </Button>
            ) : (
              <Button
                variant={isSecured ? "default" : "outline"}
                size="icon"
                className="h-10 w-10 self-end sm:self-auto"
                onClick={(event) => void handleToggleCategoryLock(event, categoryKey)}
                disabled={securedCategoriesSupport === "unavailable"}
                title={
                  securedCategoriesSupport === "unavailable"
                    ? "Kategorie-Schutz ist in dieser Umgebung nicht verfugbar"
                    : isSecured
                    ? "Extra-Sicherheit aktiv"
                    : "Extra-Sicherheit aktivieren"
                }
              >
                {isSecured ? (
                  <ShieldCheck className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              onClick={() => openUploadDialog(category)}
              className="w-full sm:w-auto"
            >
              <Upload className="mr-2 h-4 w-4" />
              Dokument hinzufügen
            </Button>
          </div>
        </div>

        {/* Folder Grid - Always show to allow creating folders */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categorySubcategories.map((subcategory) => {
              const docCount = getDocumentsForSubcategory(
                subcategory.id,
              ).length;
              return (
                <div
                  key={subcategory.id}
                  className="relative p-4 rounded-lg border-2 border-warmgray-200 hover:border-sage-400 hover:bg-sage-50 transition-all text-left group cursor-pointer"
                  onClick={() => setCurrentFolder(subcategory)}
                >
                  {/* Folder Actions Menu */}
                  <div
                    className="absolute top-2 right-2 z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full bg-white/50 hover:bg-white text-warmgray-400 hover:text-warmgray-900 border border-warmgray-100"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ordner-Optionen</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteFolder(subcategory)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Ordner löschen
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className="flex items-center justify-center mb-3">
                    <Folder className="w-12 h-12 text-sage-500 group-hover:text-sage-600 transition-colors" />
                  </div>
                  <p className="font-medium text-warmgray-800 text-center truncate">
                    {subcategory.name}
                  </p>
                  <p className="text-xs text-warmgray-500 text-center mt-1">
                    {docCount} Dokument{docCount !== 1 ? "e" : ""}
                  </p>
                </div>
              );
            })}
            {/* Add new folder - inline input or button */}
            {isCreatingFolderInGrid && newFolderCategory === category ? (
              <div className="p-3 rounded-lg border-2 border-sage-400 bg-sage-50 flex flex-col items-center">
                <div className="flex items-center justify-center mb-2">
                  <FolderPlus className="w-8 h-8 text-sage-500" />
                </div>
                <Input
                  placeholder="Ordnername"
                  value={newSubcategoryName}
                  onChange={(e) => setNewSubcategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateFolderInGrid();
                    } else if (e.key === "Escape") {
                      setIsCreatingFolderInGrid(false);
                      setNewFolderCategory(null);
                      setNewSubcategoryName("");
                    }
                  }}
                  autoFocus
                  className="text-center mb-3 h-10 senior-mode:h-12"
                />
                <div className="flex flex-col w-full gap-2">
                  <Button
                    size="sm"
                    className="w-full h-9 senior-mode:h-11"
                    onClick={handleCreateFolderInGrid}
                    disabled={!newSubcategoryName.trim()}
                  >
                    Erstellen
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full h-8 senior-mode:h-10 text-warmgray-500"
                    onClick={() => {
                      setIsCreatingFolderInGrid(false);
                      setNewFolderCategory(null);
                      setNewSubcategoryName("");
                    }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setIsCreatingFolderInGrid(true);
                  setNewFolderCategory(category);
                  setNewSubcategoryName("");
                }}
                className="p-4 rounded-lg border-2 border-dashed border-warmgray-300 hover:border-sage-400 hover:bg-sage-50 transition-all text-center group"
              >
                <div className="flex items-center justify-center mb-3">
                  <FolderPlus className="w-12 h-12 text-warmgray-400 group-hover:text-sage-500 transition-colors" />
                </div>
                <p className="font-medium text-warmgray-500 group-hover:text-sage-600">
                  Neuer Ordner
                </p>
              </button>
            )}
          </div>
        </div>

        {/* Documents without folder */}
        {uncategorizedDocs.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-warmgray-600 mb-3">
              Dokumente ohne Ordner
            </h3>
            <div className="space-y-2">
              {uncategorizedDocs.map(renderDocumentItem)}
            </div>
          </div>
        )}

        {/* Empty state - only when no folders AND no documents */}
        {categorySubcategories.length === 0 &&
          uncategorizedDocs.length === 0 && (
            <div className="text-center py-4 text-warmgray-500">
              <p>Noch keine Dokumente in {categoryInfo.name}</p>
              <p className="text-sm mt-1">
                Erstelle einen Ordner oben oder lade direkt ein Dokument hoch.
              </p>
            </div>
          )}
      </div>
    );
  };

  // Render folder content (documents inside a specific folder)
  const renderFolderContent = (folder: Subcategory) => {
    const folderDocs = getDocumentsForSubcategory(folder.id);
    const categoryInfo = DOCUMENT_CATEGORIES[folder.parent_category];

    return (
      <div className="space-y-4">
        {/* Breadcrumb navigation */}
        {/* Breadcrumb navigation and Upload button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center flex-wrap gap-2 text-sm sm:text-base">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentFolder(null)}
              className="text-sage-600 hover:text-sage-700 -ml-2 h-auto py-1 senior-mode:text-lg"
            >
              <ChevronRight className="w-4 h-4 rotate-180 mr-1 flex-shrink-0" />
              {categoryInfo.name}
            </Button>
            <ChevronRight className="w-4 h-4 text-warmgray-400 flex-shrink-0" />
            <div className="flex items-center gap-1 senior-mode:gap-2">
              <span className="flex items-center gap-2 text-warmgray-800 font-medium senior-mode:text-lg">
                <FolderOpen className="w-4 h-4 text-sage-600 flex-shrink-0" />
                <span className="truncate max-w-[120px] xs:max-w-[150px] sm:max-w-none">
                  {folder.name}
                </span>
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-warmgray-400"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    onClick={() => handleDeleteFolder(folder)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Ordner löschen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setUploadCategory(folder.parent_category);
              setUploadSubcategory(folder.id);
              setIsUploadOpen(true);
            }}
            className="w-full sm:w-auto h-10 senior-mode:h-12 flex-shrink-0"
          >
            <Upload className="mr-2 h-4 w-4" />
            In &quot;{folder.name}&quot; ablegen
          </Button>
        </div>

        {/* Documents in folder */}
        {folderDocs.length > 0 ? (
          <div className="space-y-2">{folderDocs.map(renderDocumentItem)}</div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-warmgray-200 rounded-lg">
            <Folder className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
            <h3 className="text-warmgray-700 font-medium mb-2">
              Dieser Ordner ist leer
            </h3>
            <p className="text-warmgray-500 text-sm mb-4">
              Legen Sie ein Dokument ab, um es hier zu speichern
            </p>
            <Button
              onClick={() => {
                setUploadCategory(folder.parent_category);
                setUploadSubcategory(folder.id);
                setIsUploadOpen(true);
              }}
            >
              <Upload className="mr-2 h-4 w-4" />
              Dokument hinzufügen
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 overflow-x-hidden px-0.5">
      {/* Header */}
      <div className="page-header">
        <h1 className="text-3xl font-serif font-semibold text-warmgray-900">
          Dokumente
        </h1>
        <p className="text-lg text-warmgray-600 mt-2">
          Organisieren Sie Ihre wichtigen Unterlagen nach Kategorien und
          Unterordnern
        </p>
      </div>
      {/* Storage Info */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-warmgray-600">
              Speicherplatz verwendet
            </span>
            <span className="text-sm font-medium text-warmgray-900">
              {formatFileSize(storageUsed)} von{" "}
              {userTier.limits.maxStorageMB >= 1024
                ? `${(userTier.limits.maxStorageMB / 1024).toFixed(0)} GB`
                : `${userTier.limits.maxStorageMB} MB`}
            </span>
          </div>
          <Progress
            value={
              (storageUsed / (userTier.limits.maxStorageMB * 1024 * 1024)) * 100
            }
            className="h-2"
          />
          <div className="flex items-center justify-between mt-3 text-sm text-warmgray-500">
            <span>
              {subcategories.length} von{" "}
              {userTier.limits.maxSubcategories === -1
                ? "∞"
                : userTier.limits.maxSubcategories}{" "}
              Unterordnern
            </span>
            <span>
              {documents.length} von{" "}
              {userTier.limits.maxDocuments === -1
                ? "∞"
                : userTier.limits.maxDocuments}{" "}
              Dokumenten
            </span>
          </div>
          {storageUsed / (1024 * 1024) > userTier.limits.maxStorageMB * 0.8 && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">
                    Speicherplatz fast voll
                  </p>
                  <p className="text-amber-700">
                    <Link href="/abo" className="underline hover:no-underline">
                      Upgraden Sie
                    </Link>{" "}
                    für mehr Speicherplatz.
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {/* Upgrade Nudge - shows when approaching document limit */}
      {userTier.limits.maxDocuments !== -1 && (
        <UpgradeNudge
          type="document"
          currentCount={documents.length}
          maxCount={userTier.limits.maxDocuments}
        />
      )}
      {/* Search and View Toggle */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("search:open"))}
            className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-lg border border-warmgray-200 bg-warmgray-50 text-warmgray-500 hover:bg-warmgray-100 transition-colors"
          >
            <Search className="w-4 h-4" />
            <span className="flex-1 text-left text-sm">Dokumente suchen…</span>
            <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-xs rounded bg-warmgray-200 text-warmgray-600">
              ⌘K
            </kbd>
          </button>
        <Button
          type="button"
          variant={privacyModeEnabled ? "default" : "outline"}
          onClick={() => {
            const next = !privacyModeEnabled;
            setPrivacyModeEnabled(next);
            window.localStorage.setItem(
              "docs_privacy_mode",
              next ? "enabled" : "disabled",
            );
          }}
          className="w-full sm:w-auto"
        >
          <Shield className="mr-2 h-4 w-4" />
          {privacyModeEnabled ? "Privatmodus aktiv" : "Privatmodus"}
        </Button>
        <Button
          onClick={() => openUploadDialog(selectedCategory || "identitaet")}
          className="w-full sm:w-auto"
        >
          <Upload className="mr-2 h-5 w-5" />
          Dokument hinzufügen
        </Button>
        </div>
        {availableTags.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-warmgray-500 uppercase tracking-wide">
                Tags
                {activeTagFilters.size > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-sage-500 text-white rounded-full">
                    {activeTagFilters.size}
                  </span>
                )}
              </span>
              {activeTagFilters.size > 0 && (
                <button
                  type="button"
                  onClick={() => updateTagFilters(new Set())}
                  className="text-xs text-warmgray-500 hover:text-warmgray-700 transition-colors"
                >
                  Alle zurücksetzen
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableTags.map((tag) => {
                const count = tagCounts.get(tag) ?? 0;
                const isActive = activeTagFilters.has(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      updateTagFilters((prev) => {
                        const next = new Set(prev);
                        next.has(tag) ? next.delete(tag) : next.add(tag);
                        return next;
                      })
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isActive
                        ? "bg-sage-500 text-white border-sage-500 shadow-sm"
                        : count === 0
                          ? "bg-white text-warmgray-400 border-warmgray-200 cursor-default opacity-50"
                          : "bg-white text-warmgray-700 border-warmgray-300 hover:border-sage-400 hover:bg-sage-50"
                    }`}
                    disabled={count === 0 && !isActive}
                  >
                    {tag}
                    <span
                      className={`text-[10px] px-1 py-0.5 rounded-full font-bold ${
                        isActive
                          ? "bg-white/20"
                          : "bg-warmgray-100 text-warmgray-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Category Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val);
          if (val.startsWith("custom:")) {
            const customId = val.replace("custom:", "");
            setSelectedCustomCategory(customId);
            setSelectedCategory(null);
          } else if (val === "overview" || val === "all") {
            setSelectedCustomCategory(null);
            setSelectedCategory(null);
          } else {
            setSelectedCustomCategory(null);
            setSelectedCategory(val as DocumentCategory);
          }
          setCurrentFolder(null); // Reset folder when changing category
        }}
      >
        <TabsList
          className="w-full h-auto justify-start bg-transparent gap-2 p-0 flex-wrap"
        >
          {/* Overview Tab - First */}
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700"
          >
            Übersicht
          </TabsTrigger>
          {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => {
            const count = getDocumentCountForCategory(key as DocumentCategory);
            return (
              <TabsTrigger
                key={key}
                value={key}
                className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700"
              >
                {category.name} ({count})
              </TabsTrigger>
            );
          })}
          {/* Custom Categories */}
          {customCategories.map((cat) => {
            const count = getDocumentCountForCustomCategory(cat.id);
            const CustomIcon = resolveCategoryIcon(cat.icon);
            return (
              <TabsTrigger
                key={cat.id}
                value={`custom:${cat.id}`}
                className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700 group relative"
              >
                <CustomIcon className="w-3 h-3 mr-1" />
                {cat.name} ({count})
              </TabsTrigger>
            );
          })}
          {/* All Tab */}
          <TabsTrigger
            value="all"
            className="data-[state=active]:bg-sage-100 data-[state=active]:text-sage-700"
          >
            Alle ({validatedDocuments.length})
          </TabsTrigger>
          {/* Add Category Button - Last */}
          {userTier.limits.maxCustomCategories !== 0 &&
            (userTier.limits.maxCustomCategories === -1 ||
              customCategories.length <
                userTier.limits.maxCustomCategories) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openCategoryDialog()}
                className="h-8 text-sage-600 hover:text-sage-700 hover:bg-sage-50"
              >
                <PlusCircle className="w-4 h-4 mr-1" />
                Neue Kategorie
              </Button>
            )}
        </TabsList>

        {/* Overview - Shows 3 newest documents + category overview */}
        <TabsContent value="overview" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
            </div>
          ) : (
            <div className="space-y-10 animate-fade-in">
              <ExpiryDashboardWidget
                documents={validatedDocuments}
                onOpenDocument={navigateToDocument}
              />

              {/* Recent Documents Section */}
              {recentDocuments.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-warmgray-900 flex items-center gap-2">
                      <Clock className="w-5 h-5 text-sage-600" />
                      Zuletzt hinzugefügt
                    </h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {recentDocuments.map((doc) => (
                      <Card 
                        key={doc.id} 
                        className="group cursor-pointer hover:border-sage-300 transition-all border-warmgray-200 hover:shadow-sm"
                        onClick={() => navigateToDocument(doc)}
                      >
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-sage-50 flex items-center justify-center flex-shrink-0 group-hover:bg-sage-100 transition-colors">
                            <FileText className="w-5 h-5 text-sage-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-warmgray-900 truncate">
                              {getDisplayTitle(doc)}
                            </p>
                            <p className="text-xs text-warmgray-500">
                              {formatDate(doc.created_at)}
                            </p>
                          </div>
                          {doc.is_encrypted && <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* Main Category Grid */}
              <div>
                <h2 className="text-lg font-semibold text-warmgray-900 mb-4">Kategorien</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Object.entries(DOCUMENT_CATEGORIES).map(([key, category]) => (
                    <CategoryCard
                      key={key}
                      categoryKey={key}
                      title={category.name}
                      description={category.description}
                      icon={iconMap[category.icon] || FileText}
                      documentCount={getDocumentCountForCategory(key as DocumentCategory)}
                      securedCategories={securedCategories}
                      isVaultUnlocked={vaultContext.isUnlocked}
                      toggleDisabled={securedCategoriesSupport === "unavailable"}
                      onCardClick={handleCategoryClick}
                      onToggleCategoryLock={handleToggleCategoryLock}
                      onAddDocument={(categoryKey) =>
                        openUploadDialog(categoryKey as DocumentCategory)
                      }
                    />
                  ))}

                  {/* Custom Category Cards */}
                  {customCategories.map((cat) => (
                    <CategoryCard
                      key={cat.id}
                      categoryKey={`custom:${cat.id}`}
                      title={cat.name}
                      description={cat.description}
                      icon={resolveCategoryIcon(cat.icon)}
                      documentCount={getDocumentCountForCustomCategory(cat.id)}
                      securedCategories={securedCategories}
                      isVaultUnlocked={vaultContext.isUnlocked}
                      toggleDisabled={securedCategoriesSupport === "unavailable"}
                      onCardClick={handleCategoryClick}
                      onToggleCategoryLock={handleToggleCategoryLock}
                      onAddDocument={() => openUploadDialog(null, cat.id)}
                    />
                  ))}

                  {/* Add Custom Category Card */}
                  <button
                    onClick={() => {
                      if (!canPerformAction(userTier, "addCustomCategory", customCategories.length)) {
                        setUpgradeModalFeature("custom_category");
                        setUpgradeModalOpen(true);
                        return;
                      }
                      openCategoryDialog();
                    }}
                    className="group p-6 rounded-xl border-2 border-dashed border-warmgray-200 hover:border-sage-400 hover:bg-sage-50 transition-all flex flex-col items-center justify-center gap-3 text-warmgray-500 hover:text-sage-700"
                  >
                    <div className="w-14 h-14 rounded-full bg-warmgray-50 flex items-center justify-center group-hover:bg-sage-100 transition-colors">
                      <Plus className="w-8 h-8" />
                    </div>
                    <span className="font-medium">Eigener Ordner</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {userTier.limits.familyDashboard && userId && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-warmgray-900 mb-4 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-sage-600" />
                Aktive Freigaben
              </h2>
              <ActiveSharesList key={sharesVersion} ownerId={userId} />
            </section>
          )}
        </TabsContent>

        {/* All documents view */}
        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
            </div>
          ) : filteredDocuments.length > 0 ? (
            <div className="space-y-3">
              {filteredDocuments.map(renderDocumentItem)}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-warmgray-100 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-warmgray-400" />
              </div>
              <h3 className="text-lg font-medium text-warmgray-900 mb-2">
                Noch keine Dokumente
              </h3>
              <p className="text-warmgray-500 mb-4">
                Fügen Sie Ihr erstes Dokument hinzu, um zu beginnen
              </p>
              <Button onClick={() => openUploadDialog("identitaet")}>
                <Upload className="mr-2 h-5 w-5" />
                Dokument hinzufügen
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Individual category views with folder structure */}
        {Object.entries(DOCUMENT_CATEGORIES).map(([key]) => (
          <TabsContent key={key} value={key} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
              </div>
            ) : currentFolder && currentFolder.parent_category === key ? (
              // Show folder contents when a folder is selected
              renderFolderContent(currentFolder)
            ) : (
              // Show folder grid for the category
              renderFolderGrid(key as DocumentCategory)
            )}
          </TabsContent>
        ))}

        {/* Custom Category Views */}
        {customCategories.map((cat) => (
          <TabsContent key={cat.id} value={`custom:${cat.id}`} className="mt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header with actions */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    {(() => {
                      const CustomIcon = resolveCategoryIcon(cat.icon);
                      return (
                        <div className="w-11 h-11 rounded-xl bg-sage-100 text-sage-700 flex items-center justify-center flex-shrink-0">
                          <CustomIcon className="w-6 h-6" />
                        </div>
                      );
                    })()}
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-warmgray-900 truncate">
                        {cat.name}
                      </h2>
                      {cat.description && (
                        <p className="text-sm text-warmgray-500 line-clamp-2">
                          {cat.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {seniorMode ? (
                      <Button
                        variant={
                          securedCategories.includes(`custom:${cat.id}`)
                            ? "default"
                            : "outline"
                        }
                        onClick={(event) =>
                          void handleToggleCategoryLock(event, `custom:${cat.id}`)
                        }
                        disabled={securedCategoriesSupport === "unavailable"}
                      >
                        {securedCategories.includes(`custom:${cat.id}`) ? (
                          <ShieldCheck className="mr-2 h-4 w-4" />
                        ) : (
                          <Shield className="mr-2 h-4 w-4" />
                        )}
                        {securedCategories.includes(`custom:${cat.id}`)
                          ? "Extra-Sicherheit aktiv"
                          : "Extra-Sicherheit aktivieren"}
                      </Button>
                    ) : (
                      <Button
                        variant={
                          securedCategories.includes(`custom:${cat.id}`)
                            ? "default"
                            : "outline"
                        }
                        size="icon"
                        onClick={(event) =>
                          void handleToggleCategoryLock(event, `custom:${cat.id}`)
                        }
                        disabled={securedCategoriesSupport === "unavailable"}
                        title={
                          securedCategoriesSupport === "unavailable"
                            ? "Kategorie-Schutz ist in dieser Umgebung nicht verfugbar"
                            : securedCategories.includes(`custom:${cat.id}`)
                            ? "Extra-Sicherheit aktiv"
                            : "Extra-Sicherheit aktivieren"
                        }
                      >
                        {securedCategories.includes(`custom:${cat.id}`) ? (
                          <ShieldCheck className="h-4 w-4" />
                        ) : (
                          <Shield className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCategoryDialog(cat)}
                      title="Bearbeiten"
                    >
                      <Pencil className="w-4 h-4 mr-1" />
                      Bearbeiten
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Löschen
                    </Button>
                    <Button onClick={() => openUploadDialog(null, cat.id)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Dokument hinzufügen
                    </Button>
                  </div>
                </div>

                {/* Documents */}
                {filteredDocuments.length > 0 ? (
                  <div className="space-y-2">
                    {filteredDocuments.map(renderDocumentItem)}
                  </div>
                ) : (
                  <div className="text-center py-12 border-2 border-dashed border-warmgray-200 rounded-lg">
                    {(() => {
                      const CustomIcon = resolveCategoryIcon(cat.icon);
                      return (
                        <CustomIcon className="w-12 h-12 text-warmgray-300 mx-auto mb-3" />
                      );
                    })()}
                    <h3 className="text-warmgray-700 font-medium mb-2">
                      Keine Dokumente in dieser Kategorie
                    </h3>
                    <p className="text-warmgray-500 text-sm mb-4">
                      Legen Sie ein Dokument ab, um es hier zu speichern
                    </p>
                    <Button onClick={() => openUploadDialog(null, cat.id)}>
                      <Upload className="mr-2 h-4 w-4" />
                      Dokument hinzufügen
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
      <DisableCategoryLockDialog
        open={isDisableCategoryLockDialogOpen}
        categoryTitle={getCategoryTitle(disableCategoryLockTarget)}
        loading={isDisablingCategoryLock}
        error={disableCategoryLockError}
        onOpenChange={(open) => {
          setIsDisableCategoryLockDialogOpen(open);
          if (!open) {
            setDisableCategoryLockTarget(null);
            setDisableCategoryLockError(null);
          }
        }}
        onConfirm={handleConfirmDisableCategoryLock}
      />
      {/* Upload Dialog */}
      <Dialog
        open={isUploadOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsUploadOpen(true);
          } else {
            handleCloseUpload();
          }
        }}
      >
        {isUploadOpen ? (
          <UploadDialog
            customCategories={customCategories}
            familyMembers={familyMembers}
            getCategorySubcategoriesForUpload={
              getCategorySubcategoriesForUpload
            }
            handleCreateSubcategory={handleCreateSubcategory}
            handleUpload={handleUpload}
            isCreatingSubcategory={isCreatingSubcategory}
            isUploading={isUploading}
            newSubcategoryName={newSubcategoryName}
            onClose={handleCloseUpload}
            setIsCreatingSubcategory={setIsCreatingSubcategory}
            setNewSubcategoryName={setNewSubcategoryName}
            setUploadCategory={setUploadCategory}
            setUploadCustomCategory={setUploadCustomCategory}
            setUploadCustomReminderDays={setUploadCustomReminderDays}
            setUploadExpiryDate={setUploadExpiryDate}
            setUploadFile={setUploadFile}
            setUploadNotes={setUploadNotes}
            setUploadReminderWatcher={setUploadReminderWatcher}
            setUploadSubcategory={setUploadSubcategory}
            setUploadTitle={setUploadTitle}
            uploadMetadata={uploadMetadata}
            setUploadMetadata={setUploadMetadata}
            uploadCategory={uploadCategory}
            uploadCustomCategory={uploadCustomCategory}
            uploadCustomReminderDays={uploadCustomReminderDays}
            uploadExpiryDate={uploadExpiryDate}
            uploadFile={uploadFile}
            uploadNotes={uploadNotes}
            uploadReminderWatcher={uploadReminderWatcher}
            uploadSubcategory={uploadSubcategory}
            uploadTitle={uploadTitle}
            tags={uploadTags}
            onTagsChange={setUploadTags}
            tagSuggestions={availableTags}
            lockAfterUpload={lockAfterUpload}
            onLockAfterUploadChange={setLockAfterUpload}
            vaultState={vaultState}
            vault={{
              unlock: vaultContext.unlock,
              unlockWithBiometric: vaultContext.unlockWithBiometric,
              hasBiometricSetup: vaultContext.hasBiometricSetup,
              isBiometricSupported: vaultContext.isBiometricSupported,
              requestSetup: vaultContext.requestSetup,
            }}
            userTier={userTier}
            validateAndSetFile={validateAndSetFile}
          />
        ) : null}
      </Dialog>
      {/* Document Preview */}
      {shareDocument !== null && (
        <ShareDocumentDialog
          document={shareDocument}
          trustedPersons={familyMembers}
          userId={userId}
          isOpen={isShareDialogOpen}
          onClose={() => { setIsShareDialogOpen(false); setShareDocument(null); }}
          onSuccess={() => { setIsShareDialogOpen(false); setShareDocument(null); setSharesVersion(v => v + 1); }}
        />
      )}

      <DocumentPreview
        isOpen={!!previewDocument}
        onClose={() => {
          setPreviewDocument(null);
          setPreviewBlob(null);
          setPreviewNotes(null);
        }}
        document={
          previewDocument
            ? {
                ...previewDocument,
                title: getDisplayTitle(previewDocument),
                notes:
                  previewNotes ??
                  (previewDocument.is_encrypted
                    ? "[Verschlüsselt]"
                    : previewDocument.notes),
              }
            : null
        }
        decryptedBlob={previewBlob}
      />
      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedDocuments.size === 1
                ? "Dokument verschieben"
                : `${selectedDocuments.size} Dokumente verschieben`}
            </DialogTitle>
            <DialogDescription>
              Wählen Sie einen Zielordner oder erstellen Sie einen neuen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Existing folders */}
            <div className="space-y-2">
              <Label>Zielordner</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {/* Remove from folder option */}
                <button
                  onClick={() => {
                    setMoveTargetFolder(null);
                    setIsCreatingFolderInMove(false);
                  }}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${
                    moveTargetFolder === null && !isCreatingFolderInMove
                      ? "border-sage-500 bg-sage-50"
                      : "border-warmgray-200 hover:border-warmgray-400"
                  }`}
                >
                  <X className="w-5 h-5 text-warmgray-500" />
                  <span className="text-sm">
                    Kein Ordner (aus Ordner entfernen)
                  </span>
                </button>

                {/* Existing folders for this category */}
                {getAvailableFoldersForMove().map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => {
                      setMoveTargetFolder(folder.id);
                      setIsCreatingFolderInMove(false);
                    }}
                    className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${
                      moveTargetFolder === folder.id
                        ? "border-sage-500 bg-sage-50"
                        : "border-warmgray-200 hover:border-warmgray-400"
                    }`}
                  >
                    <Folder className="w-5 h-5 text-sage-500" />
                    <span className="text-sm font-medium">{folder.name}</span>
                  </button>
                ))}

                {/* Create new folder option */}
                <button
                  onClick={() => {
                    setIsCreatingFolderInMove(true);
                    setMoveTargetFolder(null);
                  }}
                  className={`w-full p-3 text-left rounded-lg border-2 transition-colors flex items-center gap-3 ${
                    isCreatingFolderInMove
                      ? "border-sage-500 bg-sage-50"
                      : "border-dashed border-warmgray-300 hover:border-sage-400"
                  }`}
                >
                  <FolderPlus className="w-5 h-5 text-warmgray-400" />
                  <span className="text-sm">Neuen Ordner erstellen...</span>
                </button>
              </div>
            </div>

            {/* New folder name input */}
            {isCreatingFolderInMove && (
              <div className="space-y-2">
                <Label>Name des neuen Ordners</Label>
                <Input
                  placeholder="Ordnername eingeben"
                  value={newFolderNameInMove}
                  onChange={(e) => setNewFolderNameInMove(e.target.value)}
                  autoFocus
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsMoveDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              onClick={handleMoveDocuments}
              disabled={
                isMoving ||
                (isCreatingFolderInMove && !newFolderNameInMove.trim())
              }
            >
              {isMoving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verschieben...
                </>
              ) : (
                <>
                  <MoveRight className="mr-2 h-4 w-4" />
                  Verschieben
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Action Bar - Fixed at bottom when documents selected */}
      {selectedDocuments.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-auto min-w-max max-w-[calc(100vw-2rem)] bg-warmgray-900 text-white rounded-lg shadow-xl px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between sm:justify-start gap-2 sm:gap-6 z-50 overflow-hidden">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Check className="w-5 h-5 text-sage-400" />
            <span className="font-medium whitespace-nowrap text-sm sm:text-base">
              {selectedDocuments.size}{" "}
              <span className="hidden xs:inline">ausgewählt</span>
            </span>
          </div>
          <div className="h-6 w-px bg-warmgray-700 hidden sm:block" />
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-warmgray-800 h-9 px-2 sm:px-3 flex-shrink-0"
              onClick={() => openMoveDialog()}
            >
              <MoveRight className="sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Verschieben</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-warmgray-800 h-9 px-2 sm:px-3 flex-shrink-0"
              onClick={() => {
                const selectedDocs = documents.filter((doc) =>
                  selectedDocuments.has(doc.id),
                );
                const hasSecuredSelection = selectedDocs.some((doc) => {
                  const categoryKey = doc.custom_category_id
                    ? `custom:${doc.custom_category_id}`
                    : doc.category;
                  return isDocumentLocked(doc) || isCategoryLocked(categoryKey);
                });
                if (hasSecuredSelection && !hasRecentUnlock) {
                  setRequiresRecentUnlock(true);
                  vaultContext.requestUnlock();
                  return;
                }

                const docs = documents
                  .filter((doc) => selectedDocuments.has(doc.id))
                  .map((doc) => ({
                    id: doc.id,
                    title: doc.title,
                    wrapped_dek: doc.wrapped_dek ?? null,
                  }));
                setBulkShareDocuments(docs);
                if (familyMembers.length === 0) fetchFamilyMembers();
                setIsBulkShareDialogOpen(true);
              }}
            >
              <Share2 className="sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Teilen</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-warmgray-800 h-9 px-2 sm:px-3 flex-shrink-0"
              disabled={isApplyingBulkSecurity}
              onClick={() => {
                const selectedDocIds = Array.from(selectedDocuments);
                if (selectedDocIds.length === 0) {
                  clearPendingBulkSecurityAction();
                  return;
                }

                if (!hasRecentUnlock) {
                  setRequiresRecentUnlock(true);
                  setPendingBulkSecurityAction("lock");
                  setPendingBulkSecuritySelectionIds(selectedDocIds);
                  setIsAwaitingBulkSecurityUnlock(true);
                  vaultContext.requestUnlock();
                  return;
                }
                clearPendingBulkSecurityAction();
                void applyBulkDocumentSecurity(true, selectedDocIds);
              }}
            >
              <Lock className="sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sperren</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-warmgray-800 h-9 px-2 sm:px-3 flex-shrink-0"
              disabled={isApplyingBulkSecurity}
              onClick={() => {
                const selectedDocIds = Array.from(selectedDocuments);
                if (selectedDocIds.length === 0) {
                  clearPendingBulkSecurityAction();
                  return;
                }

                if (!hasRecentUnlock) {
                  setRequiresRecentUnlock(true);
                  setPendingBulkSecurityAction("unlock");
                  setPendingBulkSecuritySelectionIds(selectedDocIds);
                  setIsAwaitingBulkSecurityUnlock(true);
                  vaultContext.requestUnlock();
                  return;
                }
                clearPendingBulkSecurityAction();
                void applyBulkDocumentSecurity(false, selectedDocIds);
              }}
            >
              <ShieldOff className="sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Entsperren</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:bg-warmgray-800 h-9 px-2 sm:px-3 flex-shrink-0"
              onClick={clearSelection}
            >
              <X className="sm:mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Auswahl aufheben</span>
              <span className="sm:hidden">Abbrechen</span>
            </Button>
          </div>
        </div>
      )}
      <BulkShareDialog
        key={isBulkShareDialogOpen ? "open" : "closed"}
        documents={bulkShareDocuments}
        trustedPersons={familyMembers}
        userId={userId}
        isOpen={isBulkShareDialogOpen}
        onClose={() => setIsBulkShareDialogOpen(false)}
        onSuccess={() => { setIsBulkShareDialogOpen(false); setSharesVersion(v => v + 1); }}
      />
      {/* Category Dialog */}
      <Dialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? "Kategorie bearbeiten"
                : "Neue Kategorie erstellen"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Ändern Sie den Namen oder die Beschreibung der Kategorie."
                : "Erstellen Sie eine eigene Kategorie für Ihre Dokumente."}
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSaveCategory();
            }}
          >
            {categoryError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {categoryError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="category-name">Name *</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                placeholder="z.B. Fahrzeuge, Haustiere, Hobbys"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-description">
                Beschreibung (optional)
              </Label>
              <Input
                id="category-description"
                value={categoryForm.description}
                onChange={(e) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: e.target.value,
                  })
                }
                placeholder="Kurze Beschreibung der Kategorie"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category-icon-search">Icon auswählen</Label>
              <Input
                id="category-icon-search"
                value={categoryIconSearch}
                onChange={(event) => setCategoryIconSearch(event.target.value)}
                placeholder="Icon suchen (z.B. Car, Paw, Plane)"
              />
              <div className="max-h-44 overflow-y-auto rounded-lg border border-warmgray-200 p-2">
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {filteredCategoryIconOptions.slice(0, 84).map((iconOption) => {
                    const IconComponent = resolveCategoryIcon(iconOption.value);
                    const selected = categoryForm.icon === iconOption.value;
                    return (
                      <button
                        key={iconOption.value}
                        type="button"
                        className={`h-10 w-10 rounded-md border transition-colors flex items-center justify-center ${
                          selected
                            ? "border-sage-500 bg-sage-50 text-sage-700"
                            : "border-warmgray-200 text-warmgray-600 hover:border-sage-300 hover:text-sage-700"
                        }`}
                        onClick={() =>
                          setCategoryForm((prev) => ({
                            ...prev,
                            icon: iconOption.value,
                          }))
                        }
                        title={iconOption.label}
                        aria-label={iconOption.label}
                      >
                        <IconComponent className="h-4 w-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCategoryDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={isSavingCategory || !categoryForm.name.trim()}
              >
                {isSavingCategory ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Speichern...
                  </>
                ) : (
                  "Speichern"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Encrypted Notes Editor Dialog */}
      <Dialog
        open={!!notesEditorDoc}
        onOpenChange={(open) => { if (!open) setNotesEditorDoc(null); }}
      >
        <DialogContent className="flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Notiz</DialogTitle>
            <DialogDescription>
              {notesEditorDoc?.title}
            </DialogDescription>
          </DialogHeader>
          {notesEditorDoc && (
            vaultContext.isUnlocked
              ? <EncryptedNotesEditor.Unlocked
                  doc={notesEditorDoc}
                  onClose={() => setNotesEditorDoc(null)}
                  onSaveSuccess={handleEncryptedNoteSaveSuccess}
                />
              : <EncryptedNotesEditor.Locked onClose={() => setNotesEditorDoc(null)} />
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={auditLogDocumentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAuditLogDocumentId(null);
            setAuditLogDocumentTitle(null);
          }
        }}
      >
        <DialogContent className="flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Zugriffsprotokoll - {auditLogDocumentTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {auditLogLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
              </div>
            ) : auditLogEntries.length === 0 ? (
              <div className="py-8 text-center text-warmgray-500">
                Keine Einträge vorhanden.
              </div>
            ) : (
              <div>
                {auditLogEntries.map((entry) => {
                  const icon =
                    entry.event_type === "document_viewed" ? (
                      <Eye className="w-4 h-4 text-sage-600" />
                    ) : entry.event_type === "document_downloaded" ? (
                      <Download className="w-4 h-4 text-sage-600" />
                    ) : entry.event_type === "document_locked" ? (
                      <Lock className="w-4 h-4 text-sage-600" />
                    ) : (
                      <LockOpen className="w-4 h-4 text-sage-600" />
                    );

                  const label =
                    entry.event_type === "document_viewed"
                      ? "Angesehen"
                      : entry.event_type === "document_downloaded"
                        ? "Heruntergeladen"
                        : entry.event_type === "document_locked"
                          ? "Gesperrt"
                          : "Entsperrt";

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 py-2 border-b border-warmgray-100"
                    >
                      {icon}
                      <span className="font-medium text-warmgray-900">{label}</span>
                      <span className="text-sm text-warmgray-500">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Upgrade Modal - friendly limit notification */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        feature={upgradeModalFeature}
        currentLimit={
          upgradeModalFeature === "folder"
            ? userTier.limits.maxSubcategories
            : upgradeModalFeature === "document"
              ? userTier.limits.maxDocuments
              : upgradeModalFeature === "custom_category"
                ? userTier.limits.maxCustomCategories
                : undefined
        }
        basicLimit={
          upgradeModalFeature === "folder"
            ? SUBSCRIPTION_TIERS.basic.limits.maxSubcategories
            : upgradeModalFeature === "document"
              ? SUBSCRIPTION_TIERS.basic.limits.maxDocuments
              : upgradeModalFeature === "custom_category"
                ? SUBSCRIPTION_TIERS.basic.limits.maxCustomCategories
                : undefined
        }
        premiumLimit={
          upgradeModalFeature === "folder"
            ? "Unbegrenzt"
            : upgradeModalFeature === "document"
              ? "Unbegrenzt"
              : upgradeModalFeature === "custom_category"
                ? "Unbegrenzt"
                : undefined
        }
      />
    </div>
  );
}
