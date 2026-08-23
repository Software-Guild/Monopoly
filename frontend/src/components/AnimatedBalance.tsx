import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { formatMoney } from "../game/gameRules";

type BalanceChange = {
  id: number;
  amount: number;
};

export function AnimatedBalance({ amount, className = "" }: { amount: number; className?: string }) {
  const previousAmount = useRef(amount);
  const changeId = useRef(0);
  const [change, setChange] = useState<BalanceChange | null>(null);

  useEffect(() => {
    const difference = amount - previousAmount.current;
    previousAmount.current = amount;
    if (difference === 0) return;

    changeId.current += 1;
    setChange({ id: changeId.current, amount: difference });
    const timeout = window.setTimeout(() => setChange(null), 1450);
    return () => window.clearTimeout(timeout);
  }, [amount]);

  return (
    <span className={`animated-balance ${className}`} aria-live="polite">
      <AnimatePresence>
        {change && (
          <motion.span
            key={change.id}
            className={`balance-change ${change.amount > 0 ? "balance-added" : "balance-deducted"}`}
            initial={{ opacity: 0, y: 7, scale: 0.72 }}
            animate={{ opacity: 1, y: -9, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 360, damping: 24 }}
          >
            {change.amount > 0 ? "+" : "−"}{formatMoney(Math.abs(change.amount))}
          </motion.span>
        )}
      </AnimatePresence>
      <motion.strong key={amount} initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 420, damping: 24 }}>
        {formatMoney(amount)}
      </motion.strong>
    </span>
  );
}
