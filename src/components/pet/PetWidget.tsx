import { useState, useEffect, useCallback, useRef } from "react";
import { usePetStore } from "@/store/petStore";

const statusColors: Record<string, string> = {
  ready: "bg-green-500",
  standby: "bg-yellow-500",
  "setup-required": "bg-red-500",
};

const stateAnimations: Record<string, string> = {
  idle: "",
  thinking: "animate-pulse",
  answering: "animate-bounce",
};

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

  const sizeMap = { small: 16, medium: 24, large: 32 };
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

  // auto-scroll to newest entry unless a pinned entry exists or user is hovering
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
    <div
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`fixed cursor-grab active:cursor-grabbing transition-all duration-300 ease-out overflow-hidden shadow-2xl ${
        expanded ? "w-[45vw] h-[70vh] rounded-2xl" : "rounded-full"
      } ${expanded ? "bg-neutral-900" : statusColors[status]} ${
        !expanded ? stateAnimations[state] : ""
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: expanded ? undefined : dotSize,
        height: expanded ? undefined : dotSize,
        opacity: !expanded && state === "idle" ? opacityIdle : 1,
      }}
    >
      {expanded && (
        <div className="flex flex-col h-full text-white text-sm">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
            <span className="text-xs text-neutral-400 uppercase tracking-wide">
              {state}
            </span>
            <span className="text-xs text-neutral-500">Nova</span>
          </div>

          <div
            ref={scrollRef}
            onMouseEnter={(e) => {
              e.stopPropagation();
              setHovering(true);
            }}
            onMouseLeave={() => setHovering(false)}
            className="flex-1 overflow-y-auto px-4 flex flex-col gap-4"
          >
            {qaHistory.length === 0 && (
              <p className="text-neutral-500 text-xs italic">
                Listening for questions…
              </p>
            )}
            {qaHistory.map((qa) => (
              <div
                key={qa.id}
                className={`pb-3 ${
                  qa.pinned ? "border-l-2 border-blue-500 pl-2" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-red-400 font-medium leading-snug break-words">
                    {qa.question}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePin(qa.id);
                    }}
                    className={`text-[8px] leading-none shrink-0 p-0 w-3 h-3 flex items-center justify-center ${
                      qa.pinned ? "text-blue-400" : "text-neutral-500 hover:text-white"
                    }`}
                  >
                    📌
                  </button>
                </div>

                <div className="border-t border-neutral-700 mt-2 pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-neutral-400 uppercase">
                      RAG Answer
                    </span>
                    <span className="text-xs text-green-400">
                      {qa.ragConfidence >= RAG_CONFIDENCE_THRESHOLD
                        ? `🎉 RAG match ${qa.ragConfidence}%`
                        : `${qa.ragConfidence}%`}
                    </span>
                  </div>
                  <p className="text-neutral-200 leading-snug break-words">
                    {qa.ragAnswer}
                  </p>
                </div>

                {qa.ragConfidence < RAG_CONFIDENCE_THRESHOLD && (
                  <div className="border-t border-neutral-700 mt-2 pt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-neutral-400 uppercase">
                        LLM Answer
                      </span>
                      <span className="text-xs text-yellow-400">
                        {qa.llmConfidence}%
                      </span>
                    </div>
                    <p className="text-neutral-200 leading-snug break-words">
                      {qa.llmAnswer}
                    </p>
                  </div>
                )}

                <button
                  onClick={(e) => e.stopPropagation()}
                  className="self-end text-neutral-400 hover:text-white text-[10px] mt-2"
                >
                  ↻
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}