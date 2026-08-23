import { motion } from "framer-motion";
import { boardData } from "../data/boardData";
import { formatMoney, getPlayerNetWorth } from "../game/gameRules";
import type { GameState, Player } from "../types/game";

type PlayerSidebarProps = {
  state: GameState;
  currentPlayer: Player;
  ownedPropertyIds: number[];
  open: boolean;
  onClose: () => void;
  onTrade: () => void;
  onSelectProperty: (spaceId: number) => void;
  onBankrupt: () => void;
};

export function PlayerSidebar({ state, currentPlayer, ownedPropertyIds, open, onClose, onTrade, onSelectProperty, onBankrupt }: PlayerSidebarProps) {
  const leader = [...state.players].filter((player) => !player.bankrupt).sort((first, second) => getPlayerNetWorth(state, second.id) - getPlayerNetWorth(state, first.id))[0];
  const grouped = ownedPropertyIds.reduce<Record<string, number[]>>((result, id) => {
    const space = boardData[id];
    const group = space.type === "property" ? space.state ?? (space.propertyKind === "station" ? "Stations" : "Utilities") : "Other";
    return { ...result, [group]: [...(result[group] ?? []), id] };
  }, {});

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
                <div className="player-identity"><strong>{player.name} {leader?.id === player.id && <span title="Net worth leader">♛</span>}</strong><small>{isCurrent ? "CURRENT TURN" : player.inJail ? "IN JAIL" : player.bankrupt ? "BANKRUPT" : `${ownedPropertyIds.filter((id) => state.properties[id].ownerId === player.id).length} properties`}</small></div>
                <motion.b key={player.money}>{formatMoney(player.money)}</motion.b>
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

      <section className="sidebar-panel properties-panel">
        <div className="panel-heading"><div><span className="eyebrow">PORTFOLIO</span><h2>My properties</h2></div><span>{ownedPropertyIds.length}</span></div>
        {ownedPropertyIds.length === 0 ? <div className="empty-properties"><span>◇</span><p>{currentPlayer.name} has no properties yet.</p></div> : (
          <div className="property-groups">
            {Object.entries(grouped).map(([group, ids]) => <div key={group} className="property-group"><h3>{group}</h3>{ids.map((id) => {
              const space = boardData[id];
              if (space.type !== "property") return null;
              const status = state.properties[id];
              return <button type="button" key={id} onClick={() => onSelectProperty(id)}><span className="property-dot" style={{ backgroundColor: space.groupColor }} /><span>{space.shortName ?? space.name}</span>{status.hotel ? <em>🏨</em> : status.houses ? <em>{"▰".repeat(status.houses)}</em> : null}{status.mortgaged && <small>M</small>}<b>›</b></button>;
            })}</div>)}
          </div>
        )}
      </section>
    </aside>
  );
}
