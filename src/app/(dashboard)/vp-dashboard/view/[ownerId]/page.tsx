"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VpDashboardViewPage() {
  const params = useParams();
  const ownerId = params.ownerId as string;
  const supabase = createClient();

  const [documents, setDocuments] = useState<any[]>([]);
  const [shareTokens, setShareTokens] = useState<Record<string, string>>({});
  const [rk, setRk] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(`rk_${ownerId}`);
    setRk(stored);
    setHasKey(!!stored);
  }, [ownerId]);

  useEffect(() => {
    if (!ownerId) return;
    supabase
      .from("documents")
      .select("*")
      .eq("user_id", ownerId)
      .then(({ data }) => setDocuments(data || []));

    fetch(`/api/documents/share-token?ownerId=${ownerId}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const t of data.tokens || []) {
          map[t.document_id] = t.wrapped_dek_for_tp;
        }
        setShareTokens(map);
      });
  }, [ownerId, supabase]);

  const handleViewDoc = async (doc: any) => {
    if (!doc.is_encrypted) {
      const bytesRes = await fetch(
        `/api/family/view/bytes?docId=${doc.id}&ownerId=${ownerId}`,
      );
      if (!bytesRes.ok) {
        if (bytesRes.status === 403) {
          alert(
            "Der Besitzer hat ein kostenloses Abo. Ansicht ist nur mit einem kostenpflichtigen Abo verfügbar.",
          );
          return;
        }
        alert("Fehler beim Laden der Datei.");
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
      alert(
        "Kein Zugriffsschlüssel. Bitten Sie den Besitzer, Ihnen den Link erneut zu senden.",
      );
      return;
    }
    const { importRawHexKey, unwrapKey, decryptFile } =
      await import("@/lib/security/document-e2ee");
    const rkKey = await importRawHexKey(rk, ["wrapKey", "unwrapKey"]);
    const wrappedDek = shareTokens[doc.id];
    if (!wrappedDek) {
      alert("Kein Zugriffstoken für dieses Dokument.");
      return;
    }
    const dek = await unwrapKey(wrappedDek, rkKey, "AES-GCM");
    const bytesRes = await fetch(`/api/family/view/bytes?docId=${doc.id}&ownerId=${ownerId}`);
    if (!bytesRes.ok) {
      alert("Fehler beim Laden der Datei.");
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
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/family/download?ownerId=${ownerId}`);
      if (!res.ok) {
        alert("Fehler beim Erstellen des Downloads.");
        return;
      }

      const contentType = res.headers.get("Content-Type") || "";
      if (contentType.includes("application/zip")) {
        const blob = await res.blob();
        const contentDisposition = res.headers.get("Content-Disposition") || "";
        const match = contentDisposition.match(/filename="([^"]+)"/);
        const filename = match?.[1] || "Lebensordner.zip";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return;
      }

      const data = await res.json();
      if (!data?.requiresClientDecryption) {
        alert("Fehler beim Erstellen des Downloads.");
        return;
      }

      const JSZip = (await import("jszip")).default;
      const { importRawHexKey, unwrapKey, decryptFile } =
        await import("@/lib/security/document-e2ee");

      const zip = new JSZip();
      for (const doc of data.documents || []) {
        const bytesRes = await fetch(`/api/family/view/bytes?docId=${doc.id}&ownerId=${ownerId}`);
        if (!bytesRes.ok) {
          alert("Fehler beim Laden der Datei.");
          return;
        }

        const buffer = await bytesRes.arrayBuffer();
        if (doc.is_encrypted && rk && doc.wrapped_dek_for_tp) {
          const rkKey = await importRawHexKey(rk, ["wrapKey", "unwrapKey"]);
          const dek = await unwrapKey(doc.wrapped_dek_for_tp, rkKey, "AES-GCM");
          const plain = await decryptFile(buffer, dek, doc.file_iv);
          zip.file(`${doc.category}/${doc.file_name}`, plain);
        } else {
          zip.file(`${doc.category}/${doc.file_name}`, buffer);
        }
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const safeOwnerName = (data.ownerName || "Lebensordner")
        .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "")
        .replace(/\s+/g, "_");
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `Lebensordner_${safeOwnerName}_${dateStr}.zip`;
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download all error:", error);
      alert("Fehler beim Erstellen des Downloads.");
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
      <h1 className="text-2xl font-bold mb-6">Dokumente</h1>
      <div className="mb-4">
        <button
          onClick={handleDownloadAll}
          disabled={isDownloading}
          className="px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isDownloading ? "Wird erstellt..." : "Alle herunterladen"}
        </button>
      </div>
      <div className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div>
              <p className="font-medium">
                {doc.is_encrypted ? "[Verschlüsselt]" : doc.title}
              </p>
              <p className="text-sm text-gray-500">{doc.category}</p>
            </div>
            <button
              onClick={() => handleViewDoc(doc)}
              className="px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700"
            >
              Öffnen
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
