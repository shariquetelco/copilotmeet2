import { useEffect, useState } from "react";
import { useDocumentStore } from "@/store/documentStore";
import { Document, FREE_TIER_LIMIT_BYTES, documentService, SearchResult } from "@/lib/documentService";
import ProcessingStepper from "@/components/documents/ProcessingStepper";
import { Search, Sparkles, AlertTriangle } from "lucide-react";

function KnowledgeScoreSection({ projectId }: { projectId: string }) {
  const [data, setData] = useState<{
    score: number;
    project_trained: boolean;
    personal_profile_exists: boolean;
    document_count: number;
    new_document_count: number;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke("get_personalization_score", { projectId });
      setData(result as any);
    })();
  }, [projectId]);

  if (!data) return null;

  return (
    <div className="bg-card rounded-2xl shadow-sm p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[15px] font-semibold text-foreground">Knowledge Score</span>
        <span className="text-[20px] font-bold text-primary">{data.score}%</span>
      </div>
      <div className="flex flex-col gap-1.5 text-[14px]">
        <div className={`flex items-center gap-2 ${data.project_trained ? "text-foreground" : "text-muted-foreground"}`}>
          {data.project_trained ? <CheckCircle2 size={15} className="text-success" /> : <span className="w-[15px]" />}
          Project trained
        </div>
        <div className={`flex items-center gap-2 ${data.personal_profile_exists ? "text-foreground" : "text-muted-foreground"}`}>
          {data.personal_profile_exists ? <CheckCircle2 size={15} className="text-success" /> : <span className="w-[15px]" />}
          Personal profile
        </div>
        <div className="flex items-center gap-2 text-foreground">
          <CheckCircle2 size={15} className="text-success" />
          {data.document_count} document{data.document_count === 1 ? "" : "s"}
        </div>
        {data.new_document_count > 0 && (
          <div className="flex items-center gap-2 text-warning">
            <AlertTriangle size={15} />
            {data.new_document_count} new document{data.new_document_count === 1 ? "" : "s"} not optimized
          </div>
        )}
      </div>
    </div>
  );
}

function TrainProjectSection({ projectId }: { projectId: string }) {
  const [stats, setStats] = useState<{ document_count: number; word_count: number; ready_to_train: boolean } | null>(null);
  const [projectName, setProjectName] = useState("");

  useEffect(() => {
    (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const s = await invoke<typeof stats>("get_project_knowledge_stats", { projectId });
      setStats(s);

      const { projectService } = await import("@/lib/projectService");
      const projects = await projectService.list();
      const name = projects.find((p: any) => p.id === projectId)?.name ?? "";
      setProjectName(name);

      const existing = await invoke("get_project_brief", { projectId });
      if (existing) {
        setReport({ ...(existing as any), project_name: name });
        const newDocs = await invoke<{ new_document_count: number }>("check_new_documents", { projectId });
        setNewDocCount(newDocs.new_document_count);
      }
    })();
  }, [projectId]);

  const [training, setTraining] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");
  const [newDocCount, setNewDocCount] = useState(0);

  async function handleTrain() {
    setTraining(true);
    setError("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke("train_project", { projectId });
      setReport(result);
      setNewDocCount(0);
    } catch (err) {
      setError(String(err));
    } finally {
      setTraining(false);
    }
  }

  async function handleOptimize() {
    setTraining(true);
    setError("");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke("optimize_knowledge", { projectId });
      setReport(result);
      setNewDocCount(0);
    } catch (err) {
      setError(String(err));
    } finally {
      setTraining(false);
    }
  }

  if (!stats || !stats.ready_to_train) return null;

  if (report) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 text-[16px] font-bold text-foreground mb-2">
          ✓ {report.project_name} is personalized
        </div>
        <p className="text-[14px] text-foreground mb-3">{report.summary}</p>
        <p className="text-[13px] text-muted-foreground">
          {report.document_count} documents · {report.word_count.toLocaleString()} words · {report.keyterm_count} key terms
          {report.generated_at && ` · Trained ${new Date(report.generated_at).toLocaleDateString()}`}
        </p>

        {newDocCount > 0 && (
          <div className="mt-3 pt-3 border-t border-green-200 flex items-center justify-between">
            <span className="text-[14px] text-foreground">
              {newDocCount} new document{newDocCount === 1 ? "" : "s"} detected. Your AI can become more accurate.
            </span>
            <button
              onClick={handleOptimize}
              disabled={training}
              className="px-4 py-2 bg-primary text-white rounded-xl text-[13px] font-semibold whitespace-nowrap disabled:opacity-50"
            >
              {training ? "Optimizing..." : "Optimize Knowledge"}
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={handleTrain}
            disabled={training}
            className="text-[13px] text-muted-foreground underline disabled:opacity-50"
          >
            {training ? "Retraining..." : "Retrain from scratch"}
          </button>
          <button
            onClick={async () => {
              const { save } = await import("@tauri-apps/plugin-dialog");
              const path = await save({
                defaultPath: `${report.project_name} - Project Intelligence Report.pdf`,
                filters: [{ name: "PDF", extensions: ["pdf"] }],
              });
              if (!path) return;
              const { invoke } = await import("@tauri-apps/api/core");
              await invoke("export_project_brief_pdf", { projectId, outputPath: path });
              const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
              await revealItemInDir(path);
            }}
            className="text-[13px] text-primary underline"
          >
            Export PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-2xl p-5 mb-6 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 text-[16px] font-bold text-foreground">
          <Sparkles size={18} className="text-purple-600" />
          Ready to personalize
        </div>
        <p className="text-[14px] text-muted-foreground mt-1">
          {stats.document_count} document{stats.document_count === 1 ? "" : "s"}, {stats.word_count.toLocaleString()} words analyzed.
        </p>
        {error && <p className="text-[13px] text-red-600 mt-1">{error}</p>}
      </div>
      <button
        onClick={handleTrain}
        disabled={training}
        className="px-5 py-2.5 bg-primary text-white rounded-xl text-[14px] font-semibold whitespace-nowrap disabled:opacity-50"
      >
        {training ? "Training..." : `Train CoPilot Project ${projectName}`}
      </button>
    </div>
  );
}

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
  const [isPersonal, setIsPersonal] = useState((doc as any).is_personal ?? false);
  const [toggling, setToggling] = useState(false);

  async function togglePersonal() {
    setToggling(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_document_personal", { documentId: doc.id, isPersonal: !isPersonal });
      setIsPersonal(!isPersonal);
    } finally {
      setToggling(false);
    }
  }

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
        {doc.status === "ready" && (
          <button
            onClick={togglePersonal}
            disabled={toggling}
            title="Personal documents (CV, resume, etc.) are used to learn your skills, achievements, and STAR-style answers — regular project documents are not."
            className={`text-[12px] font-semibold px-2.5 py-1 rounded-full shrink-0 disabled:opacity-50 ${
              isPersonal ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground"
            }`}
          >
            {isPersonal ? "★ Personal" : "Mark Personal"}
          </button>
        )}
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
      <KnowledgeScoreSection projectId={projectId} />
      <TrainProjectSection projectId={projectId} />
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