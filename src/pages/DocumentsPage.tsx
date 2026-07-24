import { useEffect, useState } from "react";
import { useDocumentStore } from "@/store/documentStore";
import { Document, FREE_TIER_LIMIT_BYTES, documentService, SearchResult } from "@/lib/documentService";
import ProcessingStepper from "@/components/documents/ProcessingStepper";
import { Search } from "lucide-react";

function KnowledgeSearch({ projectId }: { projectId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchTime, setSearchTime] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [topK, setTopK] = useState(5);

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const start = performance.now();
    const res = await documentService.search(projectId, query, topK);
    setSearchTime(Math.round(performance.now() - start));
    setResults(res);
    setLoading(false);
  };

  return (
    <div className="bg-card rounded-2xl shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[16px] font-bold text-foreground flex items-center gap-2">
          <Search size={18} />
          Knowledge Search
        </h3>
        <select
          value={topK}
          onChange={(e) => setTopK(Number(e.target.value))}
          className="text-[13px] border border-input rounded-lg px-2 py-1 bg-white"
        >
          <option value={3}>Top 3</option>
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
        </select>
      </div>
      <div className="flex gap-2 mb-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch()}
          placeholder="Ask a question about your documents…"
          className="flex-1 border border-input rounded-lg px-3 py-2 text-[15px] bg-white"
        />
        <button
          onClick={runSearch}
          disabled={loading}
          className="px-4 py-2 bg-primary text-white rounded-lg text-[14px] font-semibold"
        >
          🔍 {loading ? "Searching…" : "Search"}
        </button>
      </div>

      {searchTime !== null && (
        <p className="text-[12px] text-muted-foreground mb-3">
          {results.length} results in {searchTime}ms
        </p>
      )}

      <div className="flex flex-col gap-3">
        {results.map((r, i) => (
          <div key={r.id} className="border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] font-bold text-primary">#{i + 1}</span>
              <span className="text-[12px] font-mono text-muted-foreground">
                distance: {r.distance.toFixed(4)}
              </span>
            </div>
            <p className="text-[14px] text-foreground leading-snug">{r.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  Presentation,
  Upload,
  Trash2,
  CheckCircle2,
} from "lucide-react";

const SUPPORTED_PROCESSING_TYPES = ["TXT", "MD", "PDF", "DOCX", "XLSX", "PPTX", "PNG", "JPG", "JPEG"];

const fileIcons: Record<string, any> = {
  PDF: FileText,
  DOCX: FileText,
  TXT: FileText,
  MD: FileText,
  PPTX: Presentation,
  XLSX: FileSpreadsheet,
  PNG: FileImage,
  JPG: FileImage,
  JPEG: FileImage,
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StorageMeter({ used, limit }: { used: number; limit: number }) {
  const percent = Math.min((used / limit) * 100, 100);
  const isFull = used >= limit;

  return (
    <div className="bg-card rounded-2xl shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[15px] font-semibold text-foreground">Storage</span>
        <span className="text-[14px] text-muted-foreground">
          {formatSize(used)} / {formatSize(limit)} ({Math.round(percent)}%)
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isFull ? "bg-red-500" : "bg-primary"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <button className="mt-3 text-[13px] font-semibold text-primary hover:underline">
        Upgrade to Premium — get 200 MB per project (1000% more storage)
      </button>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-green-100 text-success flex items-center gap-1 shrink-0">
        <CheckCircle2 size={12} />
        Ready
      </span>
    );
  }
  if (status === "uploaded") {
    return (
      <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-orange-100 text-warning shrink-0">
        Processing not yet supported for this file type
      </span>
    );
  }
  return (
    <span className="text-[12px] font-semibold px-2 py-1 rounded-full bg-secondary text-primary shrink-0">
      {status}
    </span>
  );
}

function DocumentRow({ doc, onDelete }: { doc: Document; onDelete: () => void }) {
  const Icon = fileIcons[doc.file_type] ?? FileText;

  return (
    <div className="bg-card rounded-2xl shadow-sm px-5 py-4 transition-all hover:shadow-md">
      <div className="flex items-center gap-4">
        <Icon size={28} className="text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-semibold text-foreground truncate">
            {doc.file_name}
          </div>
          <div className="text-[13px] text-muted-foreground">
            {doc.file_type} · {formatSize(doc.file_size_bytes)}
          </div>
        </div>
        <StatusBadge status={doc.status} />
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 shrink-0"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {doc.status !== "ready" && SUPPORTED_PROCESSING_TYPES.includes(doc.file_type) && (
        <ProcessingStepper documentId={doc.id} />
      )}
    </div>
  );
}

export default function DocumentsPage({ projectId }: { projectId: string }) {
  const { documents, storageUsed, error, loading, fetchDocuments, uploadFiles, deleteDocument } =
    useDocumentStore();

  useEffect(() => {
    fetchDocuments(projectId);
  }, [projectId]);

  return (
    <div>
      <StorageMeter used={storageUsed} limit={FREE_TIER_LIMIT_BYTES} />
      <KnowledgeSearch projectId={projectId} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
          <h3 className="text-[16px] font-bold text-red-700 mb-1">
            {error.startsWith("Storage Limit Reached") ? "❌ Storage Limit Reached" : "Error"}
          </h3>
          <p className="text-[14px] text-red-600">{error}</p>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <p className="text-[16px] text-muted-foreground">
          Organize your knowledge for this project.
        </p>
        <button
          onClick={() => uploadFiles(projectId)}
          disabled={loading}
          className="px-4 py-3 rounded-xl text-[15px] font-semibold bg-primary text-white hover:opacity-90 flex items-center gap-2 disabled:opacity-60"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Upload size={18} />
              Upload
            </>
          )}
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="bg-card rounded-2xl shadow-sm p-12 text-center">
          <Upload size={40} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="text-[20px] font-bold text-foreground mb-1">
            Drop files here
          </h3>
          <p className="text-[15px] text-muted-foreground mb-4">
            or use the Upload button above
          </p>
          <p className="text-[13px] text-muted-foreground">
            Supported: PDF · Word · PowerPoint · Excel · Images · Text
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {documents.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              onDelete={() => deleteDocument(doc.id, doc.file_path, projectId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}