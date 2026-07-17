import { motion } from "framer-motion";

interface PetFaceProps {
  blinking: boolean;
  mouthState: "flat" | "smile" | "talking";
  eyeOffsetX?: number;
  tilt: number;
  color: string;
}

export default function PetFace({
  blinking,
  mouthState,
  eyeOffsetX = 0,
  tilt,
  color,
}: PetFaceProps) {
  const eyeCy = blinking ? 46 : 42;
  const eyeRy = blinking ? 0.5 : 6;

  return (
    <motion.svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      animate={{ rotate: tilt }}
      transition={{ type: "spring", stiffness: 120, damping: 12 }}
    >
      {/* body */}
      <circle cx="50" cy="50" r="46" fill={color} />

      {/* left eye */}
      <ellipse
        cx={38 + eyeOffsetX}
        cy={eyeCy}
        rx={6}
        ry={eyeRy}
        fill="white"
      />

      {/* right eye */}
      <ellipse
        cx={62 + eyeOffsetX}
        cy={eyeCy}
        rx={6}
        ry={eyeRy}
        fill="white"
      />

      {/* mouth */}
      {mouthState === "flat" && (
        <line
          x1="40"
          y1="66"
          x2="60"
          y2="66"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
      )}
      {mouthState === "smile" && (
        <path
          d="M 36 62 Q 50 74 64 62"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {mouthState === "talking" && (
        <motion.ellipse
          cx="50"
          cy="66"
          rx="8"
          ry={6}
          fill="white"
          animate={{ ry: [4, 8, 4] }}
          transition={{ duration: 0.4, repeat: Infinity }}
        />
      )}
    </motion.svg>
  );
}