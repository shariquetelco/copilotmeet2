import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import PetFace from "./PetFace";
import { PetState, PetStatus } from "@/store/petStore";

interface PetAvatarProps {
  state: PetState;
  status: PetStatus;
  size: number;
}

const statusColor: Record<PetStatus, string> = {
  ready: "#16A34A",
  standby: "#EA580C",
  "setup-required": "#DC2626",
};

const stateColor: Record<PetState, string> = {
  idle: "#EA580C",
  thinking: "#7C3AED",
  answering: "#16A34A",
};
const stateFace: Record<
  PetState,
  { mouth: "flat" | "smile" | "talking"; eyeOffsetX: number; tilt: number }
> = {
  idle: { mouth: "smile", tilt: 0, eyeOffsetX: 0 },
  thinking: { mouth: "flat", tilt: -6, eyeOffsetX: 3 },
  answering: { mouth: "talking", tilt: 0, eyeOffsetX: 0 },
};

export default function PetAvatar({ state, status, size }: PetAvatarProps) {
  const [blinking, setBlinking] = useState(false);

  // natural, slightly randomized blink cycle
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

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* status ring */}
      <motion.div
        className="absolute inset-[-6px] rounded-full"
        style={{
          border: `3px solid ${
            status === "setup-required" ? statusColor[status] : stateColor[state]
          }`,
        }}
        animate={
          state === "thinking"
            ? { scale: [1, 1.08, 1], opacity: [1, 0.6, 1] }
            : state === "answering"
            ? { scale: [1, 1.04, 1] }
            : { scale: 1, opacity: 1 }
        }
        transition={{
          duration: state === "thinking" ? 1.2 : 0.8,
          repeat: state === "idle" ? 0 : Infinity,
          ease: "easeInOut",
        }}
      />

      {/* breathing body */}
      <motion.div
        className="w-full h-full"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <PetFace
          blinking={blinking}
          mouthState={face.mouth}
          tilt={face.tilt}
          eyeOffsetX={face.eyeOffsetX}
          color={statusColor[status]}
        />
      </motion.div>
    </div>
  );
}