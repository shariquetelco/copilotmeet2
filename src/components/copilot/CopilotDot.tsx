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
      className={`fixed cursor-grab active:cursor-grabbing transition-all duration-300 ease-out rounded-full ${
        expanded ? "w-64 h-32" : "w-6 h-6"
      } ${expanded ? "bg-neutral-900" : statusColors[status]} ${
        !expanded ? stateAnimations[state] : ""
      }`}
      style={{ left: position.x, top: position.y }}
    >
      {expanded && (
        <div className="flex flex-col items-start justify-center h-full px-4 text-white text-sm">
          <span className="text-xs text-neutral-400 uppercase tracking-wide">
            {state}
          </span>
          <span className="mt-1">CoPilot</span>
        </div>
      )}
    </div>
  );
}