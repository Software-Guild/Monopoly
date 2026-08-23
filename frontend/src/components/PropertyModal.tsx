import { motion } from "framer-motion";
import { formatMoney, canBuild, canBuildHotel, canMortgage, canSellBuilding, ownsCompleteGroup } from "../game/gameRules";
import type { GameState, Player, PropertySpace } from "../types/game";
import { Modal } from "./Modal";

type PropertyModalProps = {
  space: PropertySpace | null;
  state: GameState;
  currentPlayer: Player;
  mandatory: boolean;
  onClose: () => void;
  onBuy: () => void;
  onAuction: () => void;
  onAction: (action: "build" | "sell" | "mortgage" | "unmortgage", space: PropertySpace) => void;
};

export function PropertyModal({ space, state, currentPlayer, mandatory, onClose, onBuy, onAuction, onAction }: PropertyModalProps) {
  if (!space) return null;
  const status = state.properties[space.id];
  const owner = state.players.find((player) => player.id === status.ownerId);
  const completeGroup = space.group ? ownsCompleteGroup(state, currentPlayer.id, space.group) : false;
  const isOwner = status.ownerId === currentPlayer.id;
  const buildEnabled = canBuild(state, currentPlayer.id, space) || canBuildHotel(state, currentPlayer.id, space);
  const sellEnabled = canSellBuilding(state, currentPlayer.id, space);
  const mortgageEnabled = canMortgage(state, currentPlayer.id, space);
  const unmortgageCost = Math.ceil(space.mortgageValue * 1.1);

  return (
    <Modal open title={space.name} eyebrow={space.state ?? (space.propertyKind === "station" ? "TRANSPORT STATION" : "UTILITY")} onClose={mandatory ? undefined : onClose} dismissible={!mandatory} className="property-modal">
      <div className="deed-band" style={{ backgroundColor: space.groupColor }} />
      <div className="deed-owner-row">
        <span>{status.ownerId ? <>Owned by <b style={{ color: owner?.color }}>{owner?.name}</b></> : "Available from the Bank"}</span>
        {status.mortgaged && <strong className="mortgaged-label">MORTGAGED</strong>}
      </div>
      {space.propertyKind === "site" && space.rent && <div className="rent-table">
        <div><span>Base rent</span><b>{formatMoney(space.rent.base)}</b></div>
        <div><span>Complete state group</span><b>{formatMoney(space.rent.monopoly)}</b></div>
        <div><span>With 1 house</span><b>{formatMoney(space.rent.house1)}</b></div>
        <div><span>With 2 houses</span><b>{formatMoney(space.rent.house2)}</b></div>
        <div><span>With 3 houses</span><b>{formatMoney(space.rent.house3)}</b></div>
        <div><span>With 4 houses</span><b>{formatMoney(space.rent.house4)}</b></div>
        <div className="hotel-rent"><span>With hotel</span><b>{formatMoney(space.rent.hotel)}</b></div>
      </div>}
      {space.propertyKind === "station" && <div className="rent-table"><div><span>1 station owned</span><b>₹25</b></div><div><span>2 stations owned</span><b>₹50</b></div><div><span>3 stations owned</span><b>₹100</b></div><div><span>4 stations owned</span><b>₹200</b></div></div>}
      {space.propertyKind === "utility" && <div className="utility-rule"><span>{space.icon}</span><p>One utility charges <b>4×</b> the dice total. Owning both charges <b>10×</b>.</p></div>}
      <div className="deed-financials">
        <div><small>Purchase price</small><strong>{formatMoney(space.price)}</strong></div>
        <div><small>Mortgage value</small><strong>{formatMoney(space.mortgageValue)}</strong></div>
        {space.houseCost && <div><small>Building cost</small><strong>{formatMoney(space.houseCost)}</strong></div>}
      </div>
      {status.ownerId && space.propertyKind === "site" && <div className="building-status"><span>Current development</span><b>{status.hotel ? "🏨 Hotel" : status.houses ? `${"▰ ".repeat(status.houses)} ${status.houses} house${status.houses === 1 ? "" : "s"}` : "Undeveloped"}</b>{completeGroup && isOwner && <small>Complete state group owned</small>}</div>}

      {!status.ownerId && mandatory && <div className="modal-actions split-actions">
        <button type="button" className="button button-secondary" onClick={onAuction}>Decline & auction</button>
        <motion.button type="button" className="button button-primary" whileTap={{ scale: 0.98 }} disabled={currentPlayer.money < space.price} onClick={onBuy}>Buy for {formatMoney(space.price)}</motion.button>
      </div>}
      {isOwner && <div className="property-actions">
        {space.propertyKind === "site" && <><button type="button" className="button button-secondary" disabled={!sellEnabled} onClick={() => onAction("sell", space)}>− Sell building</button><button type="button" className="button button-success" disabled={!buildEnabled} onClick={() => onAction("build", space)}>＋ {canBuildHotel(state, currentPlayer.id, space) ? "Build hotel" : "Build house"}</button></>}
        {!status.mortgaged ? <button type="button" className="button button-ghost" disabled={!mortgageEnabled} onClick={() => onAction("mortgage", space)}>Mortgage for {formatMoney(space.mortgageValue)}</button> : <button type="button" className="button button-primary" disabled={currentPlayer.money < unmortgageCost} onClick={() => onAction("unmortgage", space)}>Repay {formatMoney(unmortgageCost)}</button>}
      </div>}
    </Modal>
  );
}
