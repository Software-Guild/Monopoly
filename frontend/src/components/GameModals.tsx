import { motion } from "framer-motion";
import { boardData } from "../data/boardData";
import { canMortgage, canSellBuilding, formatMoney, getOwnedPropertyIds } from "../game/gameRules";
import type { GameCard, GameState, Player, PropertySpace } from "../types/game";
import { Modal } from "./Modal";

export function CardModal({ card, onContinue }: { card: GameCard | null; onContinue: () => void }) {
  return (
    <Modal open={!!card} title={card?.title} eyebrow={card?.deck === "treasure" ? "🧰 TREASURE" : "? SURPRISE"} dismissible={false} className={`card-event-modal ${card?.deck ?? ""}`}>
      {card && <><div className="card-event-icon">{card.deck === "treasure" ? "🪔" : "?"}</div><p>{card.text}</p><button type="button" className="button button-primary button-wide" onClick={onContinue}>Continue</button></>}
    </Modal>
  );
}

export function JailModal({ player, phase, onPay, onCard, onRoll }: { player: Player; phase: GameState["phase"]; onPay: () => void; onCard: () => void; onRoll: () => void }) {
  return (
    <Modal open={phase === "JAIL_DECISION"} title={`${player.name} is in Jail`} eyebrow={`ATTEMPT ${player.jailTurns + 1} OF 3`} dismissible={false} className="jail-modal">
      <div className="jail-illustration"><span>●</span><i /><i /><i /></div>
      <p className="modal-intro">Pay the fine, use a pardon card, or try your luck with doubles. Rent and permitted transactions remain active.</p>
      <div className="jail-options"><button type="button" className="button button-secondary" disabled={player.money < 50} onClick={onPay}>Pay ₹50</button><button type="button" className="button button-secondary" disabled={player.getOutOfJailCards < 1} onClick={onCard}>Use pardon ({player.getOutOfJailCards})</button><button type="button" className="button button-primary" onClick={onRoll}>⚄ Try for doubles</button></div>
    </Modal>
  );
}

export function DebtModal({ state, player, onPropertyAction, onSettle, onBankrupt }: {
  state: GameState;
  player: Player;
  onPropertyAction: (action: "sell" | "mortgage", space: PropertySpace) => void;
  onSettle: () => void;
  onBankrupt: () => void;
}) {
  const debt = state.debt;
  const creditor = state.players.find((candidate) => candidate.id === debt?.creditorId);
  const assets = getOwnedPropertyIds(state, player.id).map((id) => boardData[id]).filter((space): space is PropertySpace => space.type === "property");
  return (
    <Modal open={!!debt} title={`You owe ${creditor?.name ?? "the Bank"} ${formatMoney(debt?.amount ?? 0)}`} eyebrow="FUNDS REQUIRED" dismissible={false} className="debt-modal">
      {debt && <><div className="debt-summary"><div><small>AVAILABLE CASH</small><b>{formatMoney(player.money)}</b></div><div><small>REMAINING SHORTFALL</small><b>{formatMoney(Math.max(0, debt.amount - player.money))}</b></div></div><p className="modal-intro">Raise funds by selling buildings or mortgaging eligible property. Bankruptcy is the final option.</p><div className="debt-assets">{assets.length === 0 ? <p>No property assets are available.</p> : assets.map((space) => { const status = state.properties[space.id]; return <div key={space.id}><span className="property-dot" style={{ backgroundColor: space.groupColor }} /><strong>{space.shortName ?? space.name}</strong><small>{status.hotel ? "Hotel" : status.houses ? `${status.houses} houses` : status.mortgaged ? "Mortgaged" : formatMoney(space.mortgageValue)}</small>{canSellBuilding(state, player.id, space) && <button type="button" onClick={() => onPropertyAction("sell", space)}>Sell building</button>}{canMortgage(state, player.id, space) && <button type="button" onClick={() => onPropertyAction("mortgage", space)}>Mortgage</button>}</div>; })}</div><div className="modal-actions split-actions"><button type="button" className="button button-danger" onClick={onBankrupt}>Declare bankruptcy</button><button type="button" className="button button-success" disabled={player.money < debt.amount} onClick={onSettle}>Pay {formatMoney(debt.amount)}</button></div></>}
    </Modal>
  );
}

export function BankruptcyModal({ open, player, onConfirm, onClose }: { open: boolean; player: Player; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} title="File your bankruptcy" eyebrow="IRREVERSIBLE ACTION" onClose={onClose} className="bankruptcy-modal">
      <div className="danger-seal">!</div><p>Are you sure you want to bankrupt <b>{player.name}</b>?<br />All money and purchased properties will be resolved according to the creditor.</p><strong>This cannot be undone.</strong><div className="modal-actions split-actions"><button type="button" className="button button-danger" onClick={onConfirm}>Bankrupt</button><button type="button" className="button button-primary" onClick={onClose}>Cancel</button></div>
    </Modal>
  );
}

export function WinnerModal({ winner, state, onPlayAgain, onLogin }: { winner: Player | undefined; state: GameState; onPlayAgain: () => void; onLogin: () => void }) {
  const properties = winner ? getOwnedPropertyIds(state, winner.id).length : 0;
  return (
    <Modal open={!!winner} title={`${winner?.name ?? "Player"} wins!`} eyebrow="🏆 INDIA TYCOON" dismissible={false} className="winner-modal">
      {winner && <><div className="winner-token" style={{ backgroundColor: winner.color }}>{winner.name.slice(0, 1)}</div><p>The final empire is standing.</p><div className="winner-stats"><div><small>FINAL BALANCE</small><b>{formatMoney(winner.money)}</b></div><div><small>PROPERTIES</small><b>{properties}</b></div></div><div className="modal-actions split-actions"><button type="button" className="button button-secondary" onClick={onLogin}>Return to login</button><motion.button type="button" className="button button-primary" whileHover={{ y: -2 }} onClick={onPlayAgain}>Play again</motion.button></div></>}
    </Modal>
  );
}
