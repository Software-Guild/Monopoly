import { motion } from "framer-motion";

const dotPositions: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling, delay }: { value: number; rolling: boolean; delay: number }) {
  return (
    <motion.div
      className="die"
      animate={rolling ? { rotateX: [0, 360, 720], rotateY: [0, 540, 900], rotateZ: [0, 180, 360], y: [0, -14, 0] } : { rotateX: 0, rotateY: 0, rotateZ: 0, y: 0 }}
      transition={{ duration: 1.05, delay, ease: "easeInOut" }}
      aria-label={`Die showing ${value}`}
    >
      {Array.from({ length: 9 }, (_, index) => <span key={index} className={dotPositions[value]?.includes(index) ? "pip pip-visible" : "pip"} />)}
    </motion.div>
  );
}

export function Dice({ dice, rolling }: { dice: [number, number]; rolling: boolean }) {
  return <div className="dice-pair"><Die value={dice[0]} rolling={rolling} delay={0} /><Die value={dice[1]} rolling={rolling} delay={0.08} /></div>;
}
