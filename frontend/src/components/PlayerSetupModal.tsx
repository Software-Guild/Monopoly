import { motion } from "framer-motion";
import { useState } from "react";
import { Brand } from "./Brand";
import { Modal } from "./Modal";

type PlayerSetupModalProps = {
  onStart: (names: string[]) => void;
  onBack: () => void;
};

export function PlayerSetupModal({ onStart, onBack }: PlayerSetupModalProps) {
  const [names, setNames] = useState(["", ""]);
  const [error, setError] = useState("");

  const start = () => {
    const trimmed = names.map((name) => name.trim());
    if (trimmed.some((name) => !name)) return setError("Every player needs a name.");
    if (new Set(trimmed.map((name) => name.toLowerCase())).size !== trimmed.length) return setError("Player names must be unique.");
    onStart(trimmed);
  };

  return (
    <motion.div className="setup-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="setup-brand"><Brand /></div>
      <Modal open title="Set Up Players" eyebrow="LOCAL GAME • 2–4 PLAYERS" dismissible={false} className="setup-modal">
        <p className="modal-intro">Add the people around the table. Tokens are assigned randomly when the game begins.</p>
        <div className="player-input-list">
          {names.map((name, index) => (
            <motion.div className="player-input-row" key={index} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className={`setup-token token-preview-${index + 1}`}>{index + 1}</div>
              <label htmlFor={`player-${index}`}>Player {index + 1}</label>
              <input id={`player-${index}`} value={name} maxLength={18} placeholder={index === 0 ? "e.g. Aarav" : index === 1 ? "e.g. Riya" : "Player name"} onChange={(event) => {
                setNames((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item));
                setError("");
              }} autoFocus={index === 0} />
              {names.length > 2 && <button type="button" className="remove-player" aria-label={`Remove Player ${index + 1}`} onClick={() => setNames((current) => current.filter((_, itemIndex) => itemIndex !== index))}>×</button>}
            </motion.div>
          ))}
        </div>
        {error && <motion.p className="setup-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{error}</motion.p>}
        <button type="button" className="add-player" disabled={names.length >= 4} onClick={() => setNames((current) => [...current, ""])}><span>＋</span> Add Player <small>{names.length}/4</small></button>
        <div className="setup-actions">
          <button type="button" className="button button-ghost" onClick={onBack}>Back</button>
          <motion.button type="button" className="button button-primary" whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={start}>Start Playing <span>→</span></motion.button>
        </div>
      </Modal>
    </motion.div>
  );
}
