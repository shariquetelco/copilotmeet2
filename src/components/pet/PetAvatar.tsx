import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import PetFace, { PetPersonaId } from "./PetFace";
import { PetState, PetStatus } from "@/store/petStore";

interface PetAvatarProps {
  state: PetState;
  status: PetStatus;
  size: number;
  persona?: PetPersonaId;
}

// Each persona owns its own mini-palette. The badge fill stays constant
// for that persona; only the ring shifts within that persona's own
// color family as the state changes.
const PERSONAS: Record<PetPersonaId, { fill: string; line: string; ring: Record<PetState, string> }> = {
  nova: {
    fill: "#FDEBDD",
    line: "#7A3C1E",
    ring: { idle: "#F0B088", thinking: "#EA580C", answering: "#C2410C" },
  },
  buddy: {
    fill: "#FEF9C3",
    line: "#4D5B0E",
    ring: { idle: "#D9E86A", thinking: "#A3D63C", answering: "#65A30D" },
  },
  luna: {
    fill: "#E0F2FE",
    line: "#1E3A5F",
    ring: { idle: "#93C5FD", thinking: "#60A5FA", answering: "#1D4ED8" },
  },
  echo: {
    fill: "#CCFBF1",
    line: "#134E4A",
    ring: { idle: "#5EEAD4", thinking: "#2DD4BF", answering: "#0F766E" },
  },
  atlas: {
    fill: "#E5E7EB",
    line: "#1F2937",
    ring: { idle: "#9CA3AF", thinking: "#6B7280", answering: "#374151" },
  },
};

const statusColor: Record<PetStatus, string> = {
  ready: "#16A34A",
  standby: "#EA580C",
  "setup-required": "#DC2626",
};

const stateFace: Record<PetState, { mouth: "flat" | "smile" | "talking"; eyeState: "closed" | "open" | "alert" | "side"; eyeOffsetX: number; tilt: number }> = {
  idle: { mouth: "smile", eyeState: "open", tilt: 0, eyeOffsetX: 0 },
  thinking: { mouth: "flat", eyeState: "side", tilt: -6, eyeOffsetX: 3 },
  answering: { mouth: "talking", eyeState: "alert", tilt: 0, eyeOffsetX: 0 },
};

export default function PetAvatar({ state, status, size, persona = "nova" }: PetAvatarProps) {
  const [blinking, setBlinking] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 2500 + Math.random() * 2500;
      timeout = setTimeout(() => {
        setBlinking(true);
        setTimeout(() => setBlinking(false), 150);
        scheduleBlink();
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timeout);
  }, []);

  const face = stateFace[state];
  const palette = PERSONAS[persona] ?? PERSONAS.nova;
  const ringColor = status === "setup-required" ? statusColor[status] : palette.ring[state];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* square status ring, matching the squircle's own corner radius */}
      <motion.div
        className="absolute inset-[-6px] rounded-[26%]"
        style={{ border: `3px solid ${ringColor}` }}
        animate={
          state === "thinking"
            ? { scale: [1, 1.06, 1], opacity: [1, 0.6, 1] }
            : state === "answering"
            ? { scale: [1, 1.03, 1] }
            : { scale: 1, opacity: 1 }
        }
        transition={{
          duration: state === "thinking" ? 1.2 : 0.8,
          repeat: state === "idle" ? 0 : Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="w-full h-full"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <PetFace
          blinking={blinking}
          mouthState={face.mouth}
          eyeState={face.eyeState}
          tilt={face.tilt}
          eyeOffsetX={face.eyeOffsetX}
          fillColor={palette.fill}
          lineColor={palette.line}
        />
      </motion.div>
    </div>
  );
}