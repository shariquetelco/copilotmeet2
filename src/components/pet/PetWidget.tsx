import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePetStore, QAEntry } from "@/store/petStore";
import PetAvatar from "./PetAvatar";
import { Pin, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";

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
    <div className={`rounded-2xl p-4 bg-white ${qa.pinned ? "ring-2 ring-primary" : ""}`}>
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
          <div className="mt-3 pt-3 border-t border-border/60">
            <p
              className={`text-[15px] leading-snug break-words ${
                isLatest ? "text-blue-700" : "text-neutral-900"
              }`}
            >
              {highlightKeywords(qa.question, qa.ragAnswer)}
            </p>
          </div>

          {qa.llmAnswer && (
            <div className="mt-3 pt-3 border-t border-border/60">
              <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">
                LLM Answer
              </span>
              <p className="text-[15px] text-neutral-900 leading-snug break-words mt-1">
                {highlightKeywords(qa.question, qa.llmAnswer)}
              </p>
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
  } = usePetStore();

  const [manualQuestion, setManualQuestion] = useState("");
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

  const dockCoords = {
    "top-left": { x: 24, y: 24 },
    "top-right": { x: window.innerWidth - dotSize - 24, y: 24 },
    "bottom-left": { x: 24, y: window.innerHeight - dotSize - 24 },
    "bottom-right": {
      x: window.innerWidth - dotSize - 24,
      y: window.innerHeight - dotSize - 24,
    },
  };

  const [position, setPosition] = useState(dockCoords[dockPosition]);

  useEffect(() => {
    if (!expanded) {
      setPosition(dockCoords[dockPosition]);
    }
  }, [dockPosition]);

  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [moved, setMoved] = useState(false);
  const [hovering, setHovering] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setMoved(false);
    setOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (dragging) {
        setMoved(true);
        setPosition({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      }
    },
    [dragging, offset]
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, handleMouseMove, handleMouseUp]);

  // newest first
  const orderedHistory = [...qaHistory].reverse();

  // scroll position is left entirely to the user — no forced jumps

  const handleClick = () => {
    if (!moved) setExpanded(!expanded);
  };

  return (
    <motion.div
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`fixed cursor-grab active:cursor-grabbing ${
        expanded ? "rounded-3xl shadow-2xl bg-[#F5F7FA] overflow-hidden" : ""
      }`}
      style={{ left: position.x, top: position.y }}
      initial={false}
      animate={{
        width: expanded ? "60vw" : dotSize,
        height: expanded ? "70vh" : dotSize,
        opacity: !expanded && state === "idle" ? opacityIdle : 1,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 24 }}
    >
      {!expanded && <PetAvatar state={state} status={status} size={dotSize} />}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full"
          >
            <div className="flex items-center gap-3 px-5 pt-5 pb-3 shrink-0 border-b border-border">
              <PetAvatar state={state} status={status} size={40} />
              <div>
                <div className="font-bold text-[16px] text-foreground">Nova</div>
                <div className="text-[13px] text-muted-foreground capitalize">
                  {state}
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
              <div onClick={(e) => e.stopPropagation()} className="flex gap-2 mb-1">
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