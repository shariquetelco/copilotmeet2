import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePetStore } from "@/store/petStore";
import PetAvatar from "./PetAvatar";
import { Pin, RotateCcw } from "lucide-react";

const RAG_CONFIDENCE_THRESHOLD = 85;

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
  } = usePetStore();

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

  useEffect(() => {
    const hasPinned = qaHistory.some((q) => q.pinned);
    if (!hovering && !hasPinned && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [qaHistory, hovering]);

  const handleClick = () => {
    if (!moved) setExpanded(!expanded);
  };

  return (
    <motion.div
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`fixed cursor-grab active:cursor-grabbing ${
        expanded ? "rounded-3xl shadow-2xl bg-white overflow-hidden" : ""
      }`}
      style={{ left: position.x, top: position.y }}
      initial={false}
      animate={{
        width: expanded ? "45vw" : dotSize,
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
              className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4"
            >
              {qaHistory.length === 0 && (
                <p className="text-muted-foreground text-[15px] italic">
                  Listening for questions…
                </p>
              )}
              {qaHistory.map((qa) => (
                <div
                  key={qa.id}
                  className={`rounded-2xl p-4 bg-secondary ${
                    qa.pinned ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[17px] font-semibold text-foreground leading-snug break-words">
                      {qa.question}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(qa.id);
                      }}
                      className={`shrink-0 p-1 rounded-full ${
                        qa.pinned
                          ? "text-primary"
                          : "text-muted-foreground hover:text-primary"
                      }`}
                    >
                      <Pin size={14} fill={qa.pinned ? "currentColor" : "none"} />
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-border/60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">
                        RAG Answer
                      </span>
                      <span className="text-[12px] font-bold text-success">
                        {qa.ragConfidence >= RAG_CONFIDENCE_THRESHOLD
                          ? `🎉 ${qa.ragConfidence}% match`
                          : `${qa.ragConfidence}%`}
                      </span>
                    </div>
                    <p className="text-[15px] text-foreground leading-snug break-words">
                      {qa.ragAnswer}
                    </p>
                  </div>

                  {qa.ragConfidence < RAG_CONFIDENCE_THRESHOLD && (
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">
                          LLM Answer
                        </span>
                        <span className="text-[12px] font-bold text-warning">
                          {qa.llmConfidence}%
                        </span>
                      </div>
                      <p className="text-[15px] text-foreground leading-snug break-words">
                        {qa.llmAnswer}
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
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}