import { useState, useEffect, useCallback } from "react";
import { useCopilotStore } from "@/store/copilotStore";

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

export default function CopilotDot() {
  const { status, state, expanded, setExpanded } = useCopilotStore();

  const mockQuestion = "What is your experience with distributed systems?";
  const mockRagAnswer =
    "Based on your uploaded resume, you led the migration of a monolith to a microservices architecture handling 10k requests/sec.";
  const mockRagConfidence = 92;
  const mockLlmAnswer =
    "Distributed systems require careful handling of consistency, availability, and partition tolerance, often guided by the CAP theorem.";
  const mockLlmConfidence = 74;
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [moved, setMoved] = useState(false);

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

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

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

  const handleClick = () => {
    if (!moved) {
      setExpanded(!expanded);
    }
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className={`fixed cursor-grab active:cursor-grabbing transition-all duration-300 ease-out overflow-hidden shadow-2xl ${
        expanded ? "w-96 h-auto rounded-2xl" : "w-6 h-6 rounded-full"
      } ${expanded ? "bg-neutral-900" : statusColors[status]} ${
        !expanded ? stateAnimations[state] : ""
      }`}
      style={{ left: position.x, top: position.y }}
    >
      {expanded && (
        <div className="flex flex-col gap-3 p-4 text-white text-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400 uppercase tracking-wide">
              {state}
            </span>
            <span className="text-xs text-neutral-500">CoPilot</span>
          </div>

          <div className="text-red-400 font-medium leading-snug break-words">
            {mockQuestion}
          </div>

          <div className="border-t border-neutral-700 pt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-neutral-400 uppercase">RAG Answer</span>
              <span className="text-xs text-green-400">{mockRagConfidence}%</span>
            </div>
            <p className="text-neutral-200 leading-snug">{mockRagAnswer}</p>
          </div>

          <div className="border-t border-neutral-700 pt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-neutral-400 uppercase">LLM Answer</span>
              <span className="text-xs text-yellow-400">{mockLlmConfidence}%</span>
            </div>
            <p className="text-neutral-200 leading-snug">{mockLlmAnswer}</p>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
            }}
            className="self-end text-neutral-400 hover:text-white text-xs mt-1"
          >
            ↻ Refresh
          </button>
        </div>
      )}
    </div>
  );
}