import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePetStore, QAEntry } from "@/store/petStore";
import { projectService } from "@/lib/projectService";
import PetAvatar from "./PetAvatar";
import { Pin, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

const FALLBACK_PREFIX = "My documents don't contain this information. Based on general knowledge:";

function splitFallbackAnswer(answer: string): { prefix: string | null; body: string } {
  if (answer.startsWith(FALLBACK_PREFIX)) {
    return {
      prefix: FALLBACK_PREFIX,
      body: answer.slice(FALLBACK_PREFIX.length).trim(),
    };
  }
  return { prefix: null, body: answer };
}

function renderFormattedAnswer(question: string, text: string) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const summaryLines: string[] = [];
  const bulletLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("-") || line.startsWith("•")) {
      bulletLines.push(line.replace(/^[-•]\s*/, ""));
    } else {
      summaryLines.push(line);
    }
  }

  return (
    <>
      {summaryLines.length > 0 && (
        <p className="mb-2">{highlightKeywords(question, summaryLines.join(" "))}</p>
      )}
      {bulletLines.length > 0 && (
        <ul className="list-disc pl-5 space-y-1">
          {bulletLines.map((line, i) => (
            <li key={i}>{highlightKeywords(question, line)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

function highlightKeywords(question: string, answer: string) {
  const stopwords = new Set(["the", "a", "an", "is", "are", "what", "how", "why", "does", "do", "of", "to", "in", "on", "for", "and", "or"]);
  const keywords = Array.from(
    new Set(
      question
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 2 && !stopwords.has(w))
    )
  );

  if (keywords.length === 0) return answer;

  const pattern = new RegExp(`(${keywords.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = answer.split(pattern);

  return parts.map((part, i) =>
    keywords.some((k) => k.toLowerCase() === part.toLowerCase()) ? (
      <strong key={i}>{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function QAEntryCard({
  qa,
  isLatest,
  isExpanded,
  onToggleExpand,
  onTogglePin,
}: {
  qa: QAEntry;
  isLatest: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div
      className={`rounded-2xl p-4 ${
        isLatest ? "bg-[#EEF6FF] border-l-4 border-blue-500" : "bg-[#F8F9FA]"
      } ${qa.pinned ? "ring-2 ring-primary" : ""}`}
    >
      <div
        className="flex items-start justify-between gap-3 cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          if (!isLatest) onToggleExpand();
        }}
      >
        <div className="flex items-start gap-2">
          {!isLatest && (
            <span className="mt-1 text-muted-foreground shrink-0">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          )}
          <p className="text-[17px] font-bold text-red-600 leading-snug break-words">
            {qa.question}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={`shrink-0 p-1 rounded-full ${
            qa.pinned ? "text-primary" : "text-muted-foreground hover:text-primary"
          }`}
        >
          <Pin size={14} fill={qa.pinned ? "currentColor" : "none"} />
        </button>
      </div>

      {isExpanded && (
        <>
          {qa.sourceDocument && (
            <div className="mt-2 text-[12px] text-muted-foreground flex items-center gap-1">
              📄 Source: {qa.sourceDocument}
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border/60">
            <div
              className={`text-[15px] leading-snug break-words ${
                isLatest ? "text-blue-700" : "text-neutral-900"
              }`}
            >
              {(() => {
                const { prefix, body } = splitFallbackAnswer(qa.ragAnswer);
                return (
                  <>
                    {prefix && (
                      <span className="block italic text-gray-400 mb-2">{prefix}</span>
                    )}
                    {renderFormattedAnswer(qa.question, body)}
                  </>
                );
              })()}
            </div>
          </div>

          {qa.llmAnswer && (
            <div className="mt-3 pt-3 border-t border-border/60">
              <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">
                LLM Answer
              </span>
              <div className="text-[15px] text-neutral-900 leading-snug break-words mt-1">
                {renderFormattedAnswer(qa.question, qa.llmAnswer)}
              </div>
            </div>
          )}

          <button
            onClick={(e) => e.stopPropagation()}
            className="mt-2 flex items-center gap-1 text-muted-foreground hover:text-primary text-[12px] font-medium"
          >
            <RotateCcw size={12} />
            Refresh
          </button>
        </>
      )}
    </div>
  );
}

export default function PetWidget() {
  const {
    status,
    state,
    expanded,
    setExpanded,
    qaHistory,
    togglePin,
    size,
    position: dockPosition,
    opacityIdle,
    askQuestion,
    selectedProjectId,
    setSelectedProjectId,
    listening,
    sessionStatus,
    questionsDetected,
    toggleListening,
  } = usePetStore();

  const [manualQuestion, setManualQuestion] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string; is_active: boolean }[]>([]);

  useEffect(() => {
    projectService.list().then(setProjects);
  }, [expanded]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const sizeMap = { small: 48, medium: 64, large: 88 };
  const dotSize = sizeMap[size];
  const [hovering, setHovering] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const orderedHistory = [...qaHistory].reverse();

  // The OS window itself must match what's actually visible, otherwise an
  // oversized invisible window sits on screen blocking clicks and blocking
  // drag range. Resize + reposition the real window whenever expand state
  // changes, anchoring the bottom-right corner and clamping to the monitor
  // so expanding never pushes part of the panel off-screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { getCurrentWindow, currentMonitor } = await import("@tauri-apps/api/window");
      const { LogicalSize, LogicalPosition } = await import("@tauri-apps/api/dpi");
      const win = getCurrentWindow();
      const monitor = await currentMonitor();
      if (!monitor || cancelled) return;

      const scale = monitor.scaleFactor;
      const monitorX = monitor.position.x / scale;
      const monitorY = monitor.position.y / scale;
      const monitorW = monitor.size.width / scale;
      const monitorH = monitor.size.height / scale;

      const targetW = expanded ? 380 : dotSize + 16;
      const targetH = expanded ? 520 : dotSize + 16;

      const currentPos = await win.outerPosition();
      const currentSize = await win.outerSize();
      const curX = currentPos.x / scale;
      const curY = currentPos.y / scale;
      const curW = currentSize.width / scale;
      const curH = currentSize.height / scale;

      // Keep the bottom-right corner fixed as the anchor point while resizing
      const anchorRight = curX + curW;
      const anchorBottom = curY + curH;

      let newX = anchorRight - targetW;
      let newY = anchorBottom - targetH;

      newX = Math.min(newX, monitorX + monitorW - targetW);
      newX = Math.max(newX, monitorX);
      newY = Math.min(newY, monitorY + monitorH - targetH);
      newY = Math.max(newY, monitorY);

      await win.setSize(new LogicalSize(targetW, targetH));
      await win.setPosition(new LogicalPosition(newX, newY));
    })();
    return () => {
      cancelled = true;
    };
  }, [expanded, dotSize]);

  return (
    <motion.div
      data-tauri-drag-region={!expanded ? true : undefined}
      onClick={() => setExpanded(!expanded)}
      className={`absolute inset-0 ${!expanded ? "cursor-grab active:cursor-grabbing" : ""} ${
        expanded ? "rounded-3xl shadow-2xl bg-[#F5F7FA] overflow-hidden" : ""
      }`}
      initial={false}
      animate={{
        opacity: !expanded && state === "idle" ? opacityIdle : 1,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      {!expanded && (
        <div style={{ pointerEvents: "none", padding: 8 }}>
          <PetAvatar state={state} status={status} size={dotSize} />
        </div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full"
          >
            <div data-tauri-drag-region className="flex items-center gap-3 px-5 pt-5 pb-3 shrink-0 border-b border-border cursor-grab active:cursor-grabbing">
              <div style={{ pointerEvents: "none" }} className="flex items-center gap-3">
                <PetAvatar state={state} status={status} size={40} />
                <div>
                  <div className="font-bold text-[16px] text-foreground">Nova</div>
                  <div className="text-[13px] text-muted-foreground capitalize">
                    {state}
                  </div>
                </div>
              </div>
            </div>

            <div
              ref={scrollRef}
              onMouseEnter={(e) => {
                e.stopPropagation();
                setHovering(true);
              }}
              onMouseLeave={() => setHovering(false)}
              className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="mb-2"
              >
                <select
                  value={selectedProjectId ?? ""}
                  onChange={(e) => setSelectedProjectId(e.target.value || null)}
                  className="w-full border border-border rounded-lg px-3 py-1.5 text-[13px] bg-white text-muted-foreground"
                >
                  <option value="">
                    {projects.find((p) => p.is_active)?.name
                      ? `Active Project: ${projects.find((p) => p.is_active)?.name}`
                      : "No active project"}
                  </option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  <option value="__all__">🌐 All Projects</option>
                </select>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleListening();
                }}
                className={`w-full rounded-xl px-4 py-3 mb-3 text-left transition-colors ${
                  listening
                    ? "bg-red-50 border border-red-200"
                    : "bg-green-50 border border-green-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold text-foreground">
                    {listening ? "🔴 Stop Meeting" : "🟢 Start Meeting"}
                  </span>
                  {listening && questionsDetected > 0 && (
                    <span className="text-[12px] text-muted-foreground">
                      {questionsDetected} question{questionsDetected === 1 ? "" : "s"} detected
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-muted-foreground mt-0.5">
                  {listening ? sessionStatus : "Ready"}
                </div>
              </button>

              <div
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex gap-2 mb-1"
              >
                <input
                  value={manualQuestion}
                  onChange={(e) => setManualQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && manualQuestion.trim()) {
                      askQuestion(manualQuestion.trim());
                      setManualQuestion("");
                    }
                  }}
                  placeholder="Ask a question (manual, until live audio exists)…"
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-[14px] bg-white"
                />
              </div>

              {orderedHistory.length === 0 && (
                <p className="text-muted-foreground text-[15px] italic">
                  Listening for questions…
                </p>
              )}

              {orderedHistory.map((qa, i) => {
                const isLatest = i === 0;
                const isExpanded = isLatest || expandedIds.has(qa.id);
                return (
                  <QAEntryCard
                    key={qa.id}
                    qa={qa}
                    isLatest={isLatest}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleExpand(qa.id)}
                    onTogglePin={() => togglePin(qa.id)}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}