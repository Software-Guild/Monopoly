import { motion } from "framer-motion";
import { boardData } from "../data/boardData";
import { formatMoney } from "../game/gameRules";
import type { GameState, PropertySpace, TradeOffer } from "../types/game";
import { Modal } from "./Modal";

type TradeModalProps = {
  state: GameState;
  tradeableProperties: PropertySpace[];
  onChange: (trade: TradeOffer) => void;
  onSend: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onNegotiate: () => void;
  onClose: () => void;
};

const AssetColumn = ({
  playerName,
  playerColor,
  money,
  cash,
  cards,
  maxCards,
  properties,
  selectedIds,
  onCash,
  onCards,
  onToggle,
  label,
}: {
  playerName: string;
  playerColor: string;
  money: number;
  cash: number;
  cards: number;
  maxCards: number;
  properties: PropertySpace[];
  selectedIds: number[];
  onCash: (value: number) => void;
  onCards: (value: number) => void;
  onToggle: (id: number) => void;
  label: string;
}) => (
  <div className="trade-column">
    <div className="trade-player"><span className="player-avatar" style={{ backgroundColor: playerColor }}>{playerName.slice(0, 1)}</span><div><small>{label}</small><strong>{playerName}</strong></div><b>{formatMoney(money)}</b></div>
    <label className="trade-range"><span>Cash <b>{formatMoney(cash)}</b></span><input type="range" min={0} max={money} step={5} value={cash} onChange={(event) => onCash(Number(event.target.value))} /><small><span>₹0</span><span>{formatMoney(money)}</span></small></label>
    {maxCards > 0 && <label className="card-stepper"><span>Get Out of Jail cards</span><span><button type="button" onClick={() => onCards(Math.max(0, cards - 1))}>−</button><b>{cards}</b><button type="button" onClick={() => onCards(Math.min(maxCards, cards + 1))}>＋</button></span></label>}
    <div className="trade-assets"><small>ELIGIBLE PROPERTIES</small>{properties.length === 0 ? <p>No tradable properties</p> : properties.map((space) => <button type="button" key={space.id} className={selectedIds.includes(space.id) ? "asset-selected" : ""} style={{ borderColor: selectedIds.includes(space.id) ? playerColor : undefined }} onClick={() => onToggle(space.id)}><span className="property-dot" style={{ backgroundColor: space.groupColor }} /> <span>{space.shortName ?? space.name}</span><b>{formatMoney(space.price)}</b><i>{selectedIds.includes(space.id) ? "✓" : "+"}</i></button>)}</div>
  </div>
);

export function TradeModal({ state, tradeableProperties, onChange, onSend, onAccept, onDecline, onNegotiate, onClose }: TradeModalProps) {
  const trade = state.trade;
  if (!trade) return null;
  const proposer = state.players.find((player) => player.id === trade.proposerId);
  const recipient = state.players.find((player) => player.id === trade.recipientId);
  if (!proposer || !recipient) return null;
  const offeredSpaces = trade.offeredPropertyIds.map((id) => boardData[id]).filter((space): space is PropertySpace => space.type === "property");
  const requestedSpaces = trade.requestedPropertyIds.map((id) => boardData[id]).filter((space): space is PropertySpace => space.type === "property");

  if (trade.status === "pending") {
    return (
      <Modal open title="View trade" eyebrow="INCOMING OFFER" onClose={onClose} className="view-trade-modal">
        <div className="trade-summary-grid">
          <div className="summary-player"><span className="player-avatar" style={{ backgroundColor: proposer.color }}>{proposer.name.slice(0, 1)}</span><strong>{proposer.name}</strong><small>GIVES</small><b>{formatMoney(trade.offeredCash)}</b>{offeredSpaces.map((space) => <span key={space.id}><i className="property-dot" style={{ backgroundColor: space.groupColor }} />{space.shortName ?? space.name}</span>)}{trade.offeredCards > 0 && <span>🎫 {trade.offeredCards} pardon card</span>}</div>
          <div className="exchange-mark">⇄</div>
          <div className="summary-player"><span className="player-avatar" style={{ backgroundColor: recipient.color }}>{recipient.name.slice(0, 1)}</span><strong>{recipient.name}</strong><small>GIVES</small><b>{formatMoney(trade.requestedCash)}</b>{requestedSpaces.map((space) => <span key={space.id}><i className="property-dot" style={{ backgroundColor: space.groupColor }} />{space.shortName ?? space.name}</span>)}{trade.requestedCards > 0 && <span>🎫 {trade.requestedCards} pardon card</span>}</div>
        </div>
        <div className="modal-actions three-actions"><motion.button type="button" className="button button-success" whileTap={{ scale: 0.98 }} onClick={onAccept}>✓ Confirm</motion.button><button type="button" className="button button-danger" onClick={onDecline}>× Decline</button><button type="button" className="button button-primary" onClick={onNegotiate}>✎ Negotiate</button></div>
      </Modal>
    );
  }

  const proposerProperties = tradeableProperties.filter((space) => state.properties[space.id].ownerId === proposer.id);
  const recipientProperties = tradeableProperties.filter((space) => state.properties[space.id].ownerId === recipient.id);
  const toggle = (side: "offeredPropertyIds" | "requestedPropertyIds", id: number) => onChange({ ...trade, [side]: trade[side].includes(id) ? trade[side].filter((item) => item !== id) : [...trade[side], id] });
  const otherPlayers = state.players.filter((player) => player.id !== proposer.id && !player.bankrupt);
  const hasValue = trade.offeredCash + trade.requestedCash + trade.offeredPropertyIds.length + trade.requestedPropertyIds.length + trade.offeredCards + trade.requestedCards > 0;

  return (
    <Modal open title={trade.id === "counter" ? "Counter offer" : "Create a trade"} eyebrow="PRIVATE DEAL" onClose={onClose} className="trade-modal">
      <div className="recipient-select"><label htmlFor="trade-recipient">Trade with</label><select id="trade-recipient" value={recipient.id} onChange={(event) => onChange({ ...trade, recipientId: event.target.value, requestedCash: 0, requestedPropertyIds: [], requestedCards: 0 })}>{otherPlayers.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
      <div className="trade-grid">
        <AssetColumn playerName={proposer.name} playerColor={proposer.color} money={proposer.money} cash={trade.offeredCash} cards={trade.offeredCards} maxCards={proposer.getOutOfJailCards} properties={proposerProperties} selectedIds={trade.offeredPropertyIds} onCash={(value) => onChange({ ...trade, offeredCash: value })} onCards={(value) => onChange({ ...trade, offeredCards: value })} onToggle={(id) => toggle("offeredPropertyIds", id)} label="YOU OFFER" />
        <div className="exchange-mark">⇄</div>
        <AssetColumn playerName={recipient.name} playerColor={recipient.color} money={recipient.money} cash={trade.requestedCash} cards={trade.requestedCards} maxCards={recipient.getOutOfJailCards} properties={recipientProperties} selectedIds={trade.requestedPropertyIds} onCash={(value) => onChange({ ...trade, requestedCash: value })} onCards={(value) => onChange({ ...trade, requestedCards: value })} onToggle={(id) => toggle("requestedPropertyIds", id)} label="YOU REQUEST" />
      </div>
      <motion.button type="button" className="button button-primary send-trade" disabled={!hasValue} whileTap={{ scale: 0.98 }} onClick={onSend}>◇ Send trade</motion.button>
    </Modal>
  );
}
