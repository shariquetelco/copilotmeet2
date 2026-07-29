import { motion } from "framer-motion";

export type PetPersonaId = "nova" | "buddy" | "luna" | "echo" | "atlas";

interface PetFaceProps {
  blinking: boolean;
  mouthState: "flat" | "smile" | "talking";
  eyeOffsetX?: number;
  eyeState: "closed" | "open" | "alert" | "side";
  tilt: number;
  fillColor: string;
  lineColor: string;
}

export default function PetFace({
  blinking,
  mouthState,
  eyeOffsetX = 0,
  eyeState,
  tilt,
  fillColor,
  lineColor,
}: PetFaceProps) {
  const closedOrBlinking = blinking || eyeState === "closed";

  return (
    <motion.svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      animate={{ rotate: tilt }}
      transition={{ type: "spring", stiffness: 120, damping: 12 }}
    >
      <defs>
        <filter id="petShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* subtle offset base for a soft "sitting on the screen" bevel feel */}
      <rect x="6" y="8" width="88" height="88" rx="24" fill="black" opacity="0.08" />

      {/* squircle body */}
      <rect
        x="4"
        y="4"
        width="88"
        height="88"
        rx="24"
        fill={fillColor}
        filter="url(#petShadow)"
      />

      {/* nose — small, sits between/below the eyes, a signature detail spot */}
      <motion.path
        d="M 48 54 Q 50 58 52 54"
        stroke={lineColor}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        animate={eyeState === "alert" ? { y: [0, -1, 0] } : { y: 0 }}
        transition={{ duration: 0.6, repeat: eyeState === "alert" ? Infinity : 0 }}
      />

      {/* left eye */}
      {closedOrBlinking ? (
        <path
          d={`M ${32 + eyeOffsetX} 40 Q ${38 + eyeOffsetX} 44 ${44 + eyeOffsetX} 40`}
          stroke={lineColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <motion.circle
          cy={eyeState === "alert" ? 38 : 40}
          r={eyeState === "alert" ? 6 : 5}
          fill={lineColor}
          animate={
            eyeState === "open"
              ? { cx: [38 + eyeOffsetX, 38 + eyeOffsetX, 41 + eyeOffsetX, 41 + eyeOffsetX, 35 + eyeOffsetX, 35 + eyeOffsetX, 38 + eyeOffsetX] }
              : { cx: 38 + eyeOffsetX }
          }
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.4, 0.5, 0.7, 0.8, 0.95, 1], ease: "easeInOut" }}
        />
      )}

      {/* right eye */}
      {closedOrBlinking ? (
        <path
          d={`M ${56 + eyeOffsetX} 40 Q ${62 + eyeOffsetX} 44 ${68 + eyeOffsetX} 40`}
          stroke={lineColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <motion.circle
          cy={eyeState === "alert" ? 38 : 40}
          r={eyeState === "alert" ? 6 : 5}
          fill={lineColor}
          animate={
            eyeState === "open"
              ? { cx: [62 + eyeOffsetX, 62 + eyeOffsetX, 65 + eyeOffsetX, 65 + eyeOffsetX, 59 + eyeOffsetX, 59 + eyeOffsetX, 62 + eyeOffsetX] }
              : { cx: 62 + eyeOffsetX }
          }
          transition={{ duration: 6, repeat: Infinity, times: [0, 0.4, 0.5, 0.7, 0.8, 0.95, 1], ease: "easeInOut" }}
        />
      )}

      {/* mouth */}
      {mouthState === "flat" && (
        <path
          d="M 42 68 Q 50 66 58 68"
          stroke={lineColor}
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {mouthState === "smile" && (
        <path
          d="M 38 64 Q 50 74 62 64"
          stroke={lineColor}
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {mouthState === "talking" && (
        <motion.ellipse
          cx="50"
          cy="68"
          rx="9"
          ry={6}
          fill={lineColor}
          animate={{ ry: [4, 9, 4] }}
          transition={{ duration: 0.35, repeat: Infinity }}
        />
      )}
    </motion.svg>
  );
}