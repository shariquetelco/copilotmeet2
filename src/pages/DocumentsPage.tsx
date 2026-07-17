import { useEffect } from "react";
import { useDocumentStore } from "@/store/documentStore";
import { Document, FREE_TIER_LIMIT_BYTES } from "@/lib/documentService";
import ProcessingStepper from "@/components/documents/ProcessingStepper";
import {
  FileText,
  FileImage,
  FileSpreadsheet,
  Presentation,
  Upload,
  Trash2,
  CheckCircle2,
} from "lucide-react";

const SUPPORTED_PROCESSING_TYPES = ["TXT", "MD"];

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
  const { documents, storageUsed, error, fetchDocuments, uploadFiles, deleteDocument } =
    useDocumentStore();

  useEffect(() => {
    fetchDocuments(projectId);
  }, [projectId]);

  return (
    <div>
      <StorageMeter used={storageUsed} limit={FREE_TIER_LIMIT_BYTES} />

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
          className="px-4 py-3 rounded-xl text-[15px] font-semibold bg-primary text-white hover:opacity-90 flex items-center gap-2"
        >
          <Upload size={18} />
          Upload
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