import { useState } from "react";

type CopilotStatus = "ready" | "standby" | "setup-required";

const statusColors: Record<CopilotStatus, string> = {
  ready: "bg-green-500",
  standby: "bg-yellow-500",
  "setup-required": "bg-red-500",
};

export default function CopilotDot() {
  const [status] = useState<CopilotStatus>("standby");
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = () => setDragging(true);
  const handleMouseUp = () => setDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      setPosition({ x: e.clientX, y: e.clientY });
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="fixed inset-0"
    >
      <div
        onMouseDown={handleMouseDown}
        className={`absolute w-6 h-6 rounded-full cursor-grab active:cursor-grabbing ${statusColors[status]}`}
        style={{ left: position.x, top: position.y }}
      />
    </div>
  );
}