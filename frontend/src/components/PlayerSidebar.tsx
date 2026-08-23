import { motion } from "framer-motion";
import { getOwnedPropertyIds, getPlayerNetWorth } from "../game/gameRules";
import type { GameState } from "../types/game";
import { AnimatedBalance } from "./AnimatedBalance";

type PlayerSidebarProps = {
  state: GameState;
  open: boolean;
  onClose: () => void;
  onTrade: () => void;
  onBankrupt: () => void;
};

export function PlayerSidebar({ state, open, onClose, onTrade, onBankrupt }: PlayerSidebarProps) {
  const leader = [...state.players].filter((player) => !player.bankrupt).sort((first, second) => getPlayerNetWorth(state, second.id) - getPlayerNetWorth(state, first.id))[0];

  return (
    <aside className={`player-sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-mobile-header"><strong>Game dashboard</strong><button type="button" onClick={onClose} aria-label="Close players panel">×</button></div>
      <section className="sidebar-panel players-panel">
        <div className="panel-heading"><div><span className="eyebrow">TABLE</span><h2>Players</h2></div><span>{state.players.filter((player) => !player.bankrupt).length} active</span></div>
        <div className="player-list">
          {state.players.map((player, index) => {
            const isCurrent = index === state.currentPlayerIndex;
            return (
              <motion.div key={player.id} className={`player-card ${isCurrent ? "current-player" : ""} ${player.bankrupt ? "bankrupt-player" : ""}`} animate={{ scale: isCurrent ? 1.015 : 1, opacity: player.bankrupt ? 0.45 : 1 }} style={{ borderLeftColor: isCurrent ? player.color : "transparent" }}>
                <span className="player-avatar" style={{ backgroundColor: player.color }}>{player.name.slice(0, 1).toUpperCase()}</span>
                <div className="player-identity"><strong>{player.name} {leader?.id === player.id && <span title="Net worth leader">♛</span>}</strong><small>{isCurrent ? "CURRENT TURN" : player.inJail ? "IN JAIL" : player.bankrupt ? "BANKRUPT" : `${getOwnedPropertyIds(state, player.id).length} properties`}</small></div>
                <AnimatedBalance amount={player.money} className="sidebar-balance" />
                {player.inJail && <span className="jail-chip">JAIL</span>}
              </motion.div>
            );
          })}
        </div>
        <button type="button" className="button button-danger bankrupt-button" onClick={onBankrupt}>⚑ File bankruptcy</button>
      </section>

      <section className="sidebar-panel trades-panel">
        <div className="panel-heading"><div><span className="eyebrow">DEALS</span><h2>Trades</h2></div><button type="button" className="button button-primary button-small" disabled={state.phase !== "WAITING_FOR_END_TURN"} onClick={onTrade}>＋ Create</button></div>
        <div className="empty-trades"><span>⇄</span><p>Exchange cash, property and pardon cards with another player.</p><small>Trades unlock after your move is resolved.</small></div>
      </section>

    </aside>
  );
}
