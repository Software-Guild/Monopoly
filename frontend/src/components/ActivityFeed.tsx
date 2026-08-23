import { AnimatePresence, motion } from "framer-motion";
import type { ActivityEntry, Player } from "../types/game";

export function ActivityFeed({ entries, players }: { entries: ActivityEntry[]; players: Player[] }) {
  return (
    <div className="activity-feed" aria-live="polite">
      <AnimatePresence initial={false}>
        {entries.slice(0, 10).map((entry, index) => {
          const player = players.find((candidate) => candidate.id === entry.playerId);
          return (
            <motion.div
              key={entry.id}
              className={`activity-entry tone-${entry.tone}`}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: Math.max(0.22, 1 - index * 0.095), y: 0 }}
              exit={{ opacity: 0 }}
            >
              <span className="activity-avatar" style={{ backgroundColor: player?.color ?? "#554b6e" }}>{player?.name.slice(0, 1) ?? "•"}</span>
              <span>{entry.text}</span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
