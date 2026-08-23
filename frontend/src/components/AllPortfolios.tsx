import { motion } from "framer-motion";
import { boardData } from "../data/boardData";
import { formatMoney, getOwnedPropertyIds } from "../game/gameRules";
import type { GameState, PropertyTransferRecord } from "../types/game";
import { AnimatedBalance } from "./AnimatedBalance";

type AllPortfoliosProps = {
  state: GameState;
  onSelectProperty: (spaceId: number) => void;
};

const methodLabel: Record<PropertyTransferRecord["method"], string> = {
  "bank-purchase": "Bought from Bank",
  auction: "Won at auction",
  trade: "Received by trade",
  bankruptcy: "Bankruptcy transfer",
};

export function AllPortfolios({ state, onSelectProperty }: AllPortfoliosProps) {
  return (
    <aside className="all-portfolios" aria-label="All player portfolios">
      <header className="portfolio-rail-header">
        <span className="eyebrow">OWNERSHIP</span>
        <h2>All portfolios</h2>
        <p>Live property record for every player. The outer line is the owner; the inner strip is the state group.</p>
      </header>

      <div className="all-portfolio-list">
        {state.players.map((player) => {
          const propertyIds = getOwnedPropertyIds(state, player.id);
          const purchaseTotal = propertyIds.reduce((total, spaceId) => {
            const acquisition = [...state.propertyLedger].reverse().find((record) => record.spaceId === spaceId && record.toPlayerId === player.id);
            return total + (acquisition?.amount ?? 0);
          }, 0);

          return (
            <motion.section layout key={player.id} className={`all-portfolio-card ${player.bankrupt ? "portfolio-bankrupt" : ""}`} style={{ borderTopColor: player.color }}>
              <div className="all-portfolio-player">
                <span className="player-avatar" style={{ backgroundColor: player.color }}>{player.name.slice(0, 1).toUpperCase()}</span>
                <div><strong>{player.name}</strong><small>{propertyIds.length} propert{propertyIds.length === 1 ? "y" : "ies"}</small></div>
                <AnimatedBalance amount={player.money} className="portfolio-balance" />
              </div>

              {propertyIds.length === 0 ? (
                <p className="portfolio-empty">No property purchased yet</p>
              ) : (
                <div className="portfolio-property-list">
                  {propertyIds.map((spaceId) => {
                    const space = boardData[spaceId];
                    if (space.type !== "property") return null;
                    const status = state.properties[spaceId];
                    const acquisition = [...state.propertyLedger].reverse().find((record) => record.spaceId === spaceId && record.toPlayerId === player.id);
                    return (
                      <button type="button" key={spaceId} style={{ borderLeftColor: player.color }} onClick={() => onSelectProperty(spaceId)} title={`${player.name} owns ${space.name}. Open deed`}>
                        <span className="portfolio-property-color" style={{ backgroundColor: space.groupColor }} />
                        <span className="portfolio-property-copy">
                          <strong>{space.shortName ?? space.name}</strong>
                          <small>{acquisition ? methodLabel[acquisition.method] : "Current holding"}{acquisition?.amount !== null && acquisition?.amount !== undefined ? ` • ${formatMoney(acquisition.amount)}` : ""}</small>
                        </span>
                        <span className="portfolio-property-state">{status.mortgaged ? "M" : status.hotel ? "🏨" : status.houses ? `⌂${status.houses}` : "›"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {purchaseTotal > 0 && <div className="portfolio-invested"><span>Recorded purchase value</span><b>{formatMoney(purchaseTotal)}</b></div>}
            </motion.section>
          );
        })}
      </div>

      <section className="ownership-ledger">
        <div className="ownership-ledger-heading"><span className="eyebrow">HISTORY</span><h3>Property record</h3></div>
        {state.propertyLedger.length === 0 ? <p>No purchases recorded yet.</p> : (
          <ol>
            {[...state.propertyLedger].reverse().slice(0, 12).map((record) => {
              const property = boardData[record.spaceId];
              const from = state.players.find((player) => player.id === record.fromPlayerId);
              const to = state.players.find((player) => player.id === record.toPlayerId);
              return (
                <li key={record.id}>
                  <span>{record.sequence}</span>
                  <div><strong>{property.name}</strong><small>{from ? `${from.name} → ` : "Bank → "}{to?.name ?? "Bank"} • {methodLabel[record.method]}{record.amount !== null ? ` for ${formatMoney(record.amount)}` : ""}</small></div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </aside>
  );
}
