import { useEffect, useState } from "react";
import { documentService, DocumentJob } from "@/lib/documentService";
import { RotateCcw } from "lucide-react";

const steps = [
  { key: "extracting", icon: "📝", label: "Extracting" },
  { key: "ocr", icon: "👁", label: "OCR" },
  { key: "chunking", icon: "✂️", label: "Chunking" },
  { key: "embedding", icon: "🧠", label: "Embedding" },
];

// maps a job's current stage to how far along the 4 visible steps it is
function stepIndexForStage(stage: string): number {
  const order = ["pending", "extracting", "ocr", "cleaning", "chunking", "embedding", "indexing", "completed"];
  const stageIdx = order.indexOf(stage);
  if (stage === "completed") return steps.length;
  if (stageIdx <= order.indexOf("extracting")) return 0;
  if (stageIdx <= order.indexOf("ocr")) return 1;
  if (stageIdx <= order.indexOf("chunking")) return 2;
  return 3;
}

export default function ProcessingStepper({
  documentId,
  onRetry,
}: {
  documentId: string;
  onRetry?: () => void;
}) {
  const [job, setJob] = useState<DocumentJob | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const result = await documentService.getJob(documentId);
      if (!cancelled) setJob(result);
    };
    poll();
    const interval = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [documentId]);

  if (!job || job.stage === "completed") return null;

  if (job.stage === "failed") {
    return (
      <div className="mt-2 flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
        <span className="text-[13px] text-red-600">{job.error ?? "Processing failed"}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1 text-[13px] font-semibold text-red-700 hover:underline"
          >
            <RotateCcw size={12} />
            Retry
          </button>
        )}
      </div>
    );
  }

  const activeIndex = stepIndexForStage(job.stage);
  const percent = ((activeIndex + 1) / steps.length) * 100;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3 mb-1">
        {steps.map((s, i) => (
          <span
            key={s.key}
            className={`text-[13px] flex items-center gap-1 ${
              i <= activeIndex ? "text-primary font-semibold" : "text-muted-foreground"
            }`}
          >
            {s.icon} {s.label}
          </span>
        ))}
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}