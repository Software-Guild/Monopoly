import { motion } from "framer-motion";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "brand-compact" : ""}`}>
      <motion.div
        className="brand-mark"
        initial={{ rotate: -12, scale: 0.8 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 180 }}
        aria-hidden="true"
      >
        <span>₹</span>
      </motion.div>
      <div>
        <p className="brand-name">INDIA <strong>TYCOON</strong></p>
        {!compact && <p className="brand-tagline">Build your empire, one city at a time.</p>}
      </div>
    </div>
  );
}
