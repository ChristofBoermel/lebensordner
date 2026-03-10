"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface SharedDocument {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  category: string;
  streamToken?: string | null;
  is_encrypted?: boolean;
  file_iv?: string | null;
}

interface FamilyViewResponse {
  ownerName?: string;
  accessLevel?: string | null;
  documents?: SharedDocument[];
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function VpDashboardViewPage() {
  const params = useParams();
  const ownerId = params.ownerId as string;

  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [shareTokens, setShareTokens] = useState<Record<string, string>>({});
  const [rk, setRk] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [accessLevel, setAccessLevel] = useState<string | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState<string>("Lebensordner");
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true);

  const canDownloadAll = accessLevel === 'immediate' && documents.length > 0;
  const canOpenDocuments = accessLevel === 'immediate' || accessLevel === 'emergency';

  useEffect(() => {
    const stored = localStorage.getItem(`rk_${ownerId}`);
    setRk(stored);
    setHasKey(!!stored);
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    // allowed: I/O - hydrate trusted-person dashboard from share-scoped APIs
    async function hydrateSharedDocuments() {
      setIsLoadingDocuments(true);
      setViewError(null);

      try {
        const documentsRes = await fetch(`/api/family/view?ownerId=${encodeURIComponent(ownerId)}`);
        const documentsData: FamilyViewResponse & { error?: string } = await documentsRes.json();
        if (!documentsRes.ok) {
          setDocuments([]);
          setOwnerName("Lebensordner");
          setAccessLevel(null);
          setShareTokens({});
          setViewError(documentsData?.error || "Fehler beim Laden der Dokumente.");
          return;
        }

        const nextDocuments = documentsData.documents || [];
        setDocuments(nextDocuments);
        setOwnerName(documentsData.ownerName || "Lebensordner");
        setAccessLevel(documentsData.accessLevel ?? null);

        if (!nextDocuments.some((doc) => doc.is_encrypted)) {
          setShareTokens({});
          return;
        }

        try {
          const shareTokensRes = await fetch(
            `/api/documents/share-token?ownerId=${encodeURIComponent(ownerId)}`,
          );
          const shareTokensData = shareTokensRes.ok
            ? await shareTokensRes.json()
            : { tokens: [] };
          const map: Record<string, string> = {};
          for (const token of shareTokensData.tokens || []) {
            map[token.document_id] = token.wrapped_dek_for_tp;
          }
          setShareTokens(map);
        } catch {
          setShareTokens({});
        }
      } catch {
        setDocuments([]);
        setOwnerName("Lebensordner");
        setAccessLevel(null);
        setShareTokens({});
        setViewError("Fehler beim Laden der Dokumente.");
      } finally {
        setIsLoadingDocuments(false);
      }
    }

    hydrateSharedDocuments();
  }, [ownerId]);

  const handleViewDoc = async (doc: SharedDocument) => {
    setViewError(null);
    if (!doc.is_encrypted) {
      const bytesRes = await fetch(
        `/api/family/view/bytes?docId=${doc.id}&ownerId=${ownerId}`,
      );
      if (!bytesRes.ok) {
        if (bytesRes.status === 403) {
          setViewError(
            "Der Besitzer hat ein kostenloses Abo. Ansicht ist nur mit einem kostenpflichtigen Abo verfügbar.",
          );
          return;
        }
        setViewError("Fehler beim Laden der Datei.");
        return;
      }
      const buffer = await bytesRes.arrayBuffer();
      const blob = new Blob([buffer], {
        type: doc.file_type || "application/octet-stream",
      });
      window.open(URL.createObjectURL(blob), "_blank");
      return;
    }
    if (!rk) {
      setViewError(
        "Kein Zugriffsschlüssel. Bitten Sie den Besitzer, Ihnen den Link erneut zu senden.",
      );
      return;
    }
    const { importRawHexKey, unwrapKey, decryptFile } =
      await import("@/lib/security/document-e2ee");
    const rkKey = await importRawHexKey(rk, ["wrapKey", "unwrapKey"]);
    const wrappedDek = shareTokens[doc.id];
    if (!wrappedDek) {
      setViewError("Kein Zugriffstoken für dieses Dokument.");
      return;
    }
    if (!doc.file_iv) {
      setViewError("Freigabeinformationen für dieses Dokument fehlen.");
      return;
    }
    const dek = await unwrapKey(wrappedDek, rkKey, "AES-GCM");
    const bytesRes = await fetch(`/api/family/view/bytes?docId=${doc.id}&ownerId=${ownerId}`);
    if (!bytesRes.ok) {
      setViewError("Fehler beim Laden der Datei.");
      return;
    }
    const buffer = await bytesRes.arrayBuffer();
    const plain = await decryptFile(buffer, dek, doc.file_iv);
    const blob = new Blob([plain], {
      type: doc.file_type || "application/octet-stream",
    });
    window.open(URL.createObjectURL(blob), "_blank");
  };

  const handleDownloadAll = async () => {
    setViewError(null);
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/family/download?ownerId=${ownerId}`);
      if (!res.ok) {
        setViewError("Fehler beim Erstellen des Downloads.");
        return;
      }

      const contentType = res.headers.get("Content-Type") || "";
      if (contentType.includes("application/zip")) {
        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition") || "";
        const match = contentDisposition.match(/filename="([^"]+)"/);
        const filename = match?.[1] || "Lebensordner.zip";
        triggerBrowserDownload(blob, filename);
        return;
      }

      const data = await res.json();
      if (!data?.requiresClientDecryption) {
        setViewError("Fehler beim Erstellen des Downloads.");
        return;
      }

      const JSZip = (await import("jszip")).default;
      const { importRawHexKey, unwrapKey, decryptFile } =
        await import("@/lib/security/document-e2ee");

      const zip = new JSZip();
      for (const doc of data.documents || []) {
        const bytesRes = await fetch(`/api/family/view/bytes?docId=${doc.id}&ownerId=${ownerId}`);
        if (!bytesRes.ok) {
          setViewError("Fehler beim Laden der Datei.");
          return;
        }

        const buffer = await bytesRes.arrayBuffer();
        if (doc.is_encrypted && rk && doc.wrapped_dek_for_tp && doc.file_iv) {
          const rkKey = await importRawHexKey(rk, ["wrapKey", "unwrapKey"]);
          const dek = await unwrapKey(doc.wrapped_dek_for_tp, rkKey, "AES-GCM");
          const plain = await decryptFile(buffer, dek, doc.file_iv);
          zip.file(`${doc.category}/${doc.file_name}`, plain);
        } else {
          zip.file(`${doc.category}/${doc.file_name}`, buffer);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safeOwnerName = (data.ownerName || ownerName || "Lebensordner")
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "")
        .replace(/\s+/g, "_");
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `Lebensordner_${safeOwnerName}_${dateStr}.zip`;
      triggerBrowserDownload(zipBlob, filename);
    } catch {
      setViewError("Fehler beim Erstellen des Downloads.");
    } finally {
      setIsDownloading(false);
    }
  };

  if (hasKey === null) return <div className="p-8">Laden...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {!hasKey && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          Kein Zugriffsschlüssel gefunden. Bitten Sie den Besitzer, Ihnen den
          Zugriffslink erneut zu senden.
        </div>
      )}
      <h1 className="text-2xl font-bold mb-2">Dokumente</h1>
      <p className="text-sm text-gray-500 mb-6">Freigegeben von {ownerName}</p>
      {viewError && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {viewError}
        </div>
      )}
      <div className="mb-4">
        {canDownloadAll ? (
          <button
            onClick={handleDownloadAll}
            disabled={isDownloading}
            data-testid="download-all-documents"
            className="px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isDownloading ? "Wird erstellt..." : "Alle herunterladen"}
          </button>
        ) : documents.length > 0 && accessLevel === 'emergency' ? (
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-sm">
            Ihr Zugriff ist auf Notfall-Ansicht beschränkt. Downloads sind nicht erlaubt.
          </div>
        ) : documents.length > 0 && accessLevel === 'after_confirmation' ? (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Downloads erfordern eine Bestätigung durch den Besitzer.
          </div>
        ) : null}
      </div>
      {isLoadingDocuments ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600">
          Freigegebene Dokumente werden geladen...
        </div>
      ) : documents.length === 0 ? (
        <div
          className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-slate-700"
          data-testid="trusted-person-empty-state"
        >
          Es wurden noch keine Dokumente für Sie freigegeben.
        </div>
      ) : (
      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            data-testid={`shared-document-${doc.id}`}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div>
              <p className="font-medium">
                {doc.is_encrypted ? "[Verschlüsselt]" : doc.title}
              </p>
              <p className="text-sm text-gray-500">{doc.category}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button
                onClick={() => handleViewDoc(doc)}
                disabled={!canOpenDocuments}
                className="px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Öffnen
              </button>
              {!canOpenDocuments && accessLevel === 'after_confirmation' && (
                <span className="text-xs text-amber-700">Bestätigung erforderlich</span>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
