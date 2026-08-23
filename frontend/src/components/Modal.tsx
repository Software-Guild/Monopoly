import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose?: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
  dismissible?: boolean;
};

export function Modal({ open, onClose, title, eyebrow, children, className = "", dismissible = true }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="presentation" onMouseDown={(event) => {
          if (dismissible && event.target === event.currentTarget) onClose?.();
        }}>
          <motion.section
            className={`modal-card ${className}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 14 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {dismissible && onClose && <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>}
            {(title || eyebrow) && <header className="modal-header">{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h2>{title}</h2>}</header>}
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
