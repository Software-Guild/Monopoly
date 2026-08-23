import { motion } from "framer-motion";

const dotPositions: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const cubeOrientations: Record<number, { rotateX: number; rotateY: number }> = {
  1: { rotateX: 0, rotateY: 0 },
  2: { rotateX: 0, rotateY: -90 },
  3: { rotateX: -90, rotateY: 0 },
  4: { rotateX: 90, rotateY: 0 },
  5: { rotateX: 0, rotateY: 90 },
  6: { rotateX: 0, rotateY: 180 },
};

const faces = [
  { value: 1, className: "die-face-front" },
  { value: 6, className: "die-face-back" },
  { value: 2, className: "die-face-right" },
  { value: 5, className: "die-face-left" },
  { value: 3, className: "die-face-top" },
  { value: 4, className: "die-face-bottom" },
] as const;

function DieFace({ value, className }: { value: number; className: string }) {
  return (
    <div className={`die-face ${className}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={dotPositions[value]?.includes(index) ? "pip pip-visible" : "pip"} />
      ))}
    </div>
  );
}

function Die({ value, rolling, delay }: { value: number | null; rolling: boolean; delay: number }) {
  const orientation = value === null ? { rotateX: -18, rotateY: 28 } : cubeOrientations[value];
  return (
    <motion.div
      className="die-stage"
      animate={rolling ? { y: [0, -18, 0], scale: [1, 1.08, 1] } : { y: 0, scale: 1 }}
      transition={{ duration: 1.05, delay, ease: "easeInOut" }}
      role="img"
      aria-label={value === null ? "Die waiting for backend roll" : `Die showing ${value}`}
    >
      <motion.div
        className="die-cube"
        animate={rolling ? {
          rotateX: [orientation.rotateX, orientation.rotateX + 410, orientation.rotateX + 720],
          rotateY: [orientation.rotateY, orientation.rotateY + 530, orientation.rotateY + 1080],
          rotateZ: [0, 170, 360],
        } : { ...orientation, rotateZ: 0 }}
        transition={{ duration: rolling ? 1.05 : 0.32, delay: rolling ? delay : 0, ease: rolling ? "easeInOut" : "backOut" }}
      >
        {faces.map((face) => <DieFace key={face.value} value={face.value} className={face.className} />)}
      </motion.div>
    </motion.div>
  );
}

export function Dice({ dice, rolling }: { dice: [number, number] | null; rolling: boolean }) {
  return <div className="dice-pair"><Die value={dice?.[0] ?? null} rolling={rolling} delay={0} /><Die value={dice?.[1] ?? null} rolling={rolling} delay={0.08} /></div>;
}
