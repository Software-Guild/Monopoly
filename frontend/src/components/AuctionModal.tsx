import { useState } from "react";
import { getSpace } from "../data/boardData";
import { formatMoney } from "../game/gameRules";
import type { GameState } from "../types/game";
import { Modal } from "./Modal";

export function AuctionModal({ state, onBid, onPass }: { state: GameState; onBid: (amount: number) => void; onPass: () => void }) {
  const [customBid, setCustomBid] = useState("");
  const auction = state.auction;
  if (!auction) return null;
  const space = getSpace(auction.spaceId);
  const bidder = state.players.find((player) => player.id === auction.activeBidderId);
  const leader = state.players.find((player) => player.id === auction.highestBidderId);
  const targetBid = Number(customBid);
  return (
    <Modal open title={`Auction: ${space.name}`} eyebrow="BANK AUCTION" dismissible={false} className="auction-modal">
      <p className="modal-intro">Every active player may bid—even the player who declined the original purchase.</p>
      <div className="auction-price"><small>Current bid</small><strong>{formatMoney(auction.currentBid)}</strong><span>Highest bidder: {leader?.name ?? "None yet"}</span></div>
      <div className="auction-turn"><span className="player-avatar" style={{ backgroundColor: bidder?.color }}>{bidder?.name.slice(0, 1)}</span><div><small>NOW BIDDING</small><b>{bidder?.name}</b></div><strong>{formatMoney(bidder?.money ?? 0)}</strong></div>
      <div className="bid-buttons"><button type="button" className="button button-primary" disabled={(bidder?.money ?? 0) < auction.currentBid + 10} onClick={() => onBid(10)}>＋ ₹10</button><button type="button" className="button button-primary" disabled={(bidder?.money ?? 0) < auction.currentBid + 50} onClick={() => onBid(50)}>＋ ₹50</button></div>
      <div className="custom-bid"><input type="number" min={auction.currentBid + 1} max={bidder?.money} value={customBid} placeholder={`More than ${auction.currentBid}`} onChange={(event) => setCustomBid(event.target.value)} /><button type="button" className="button button-secondary" disabled={!targetBid || targetBid <= auction.currentBid || targetBid > (bidder?.money ?? 0)} onClick={() => { onBid(targetBid - auction.currentBid); setCustomBid(""); }}>Place custom bid</button></div>
      <button type="button" className="button button-ghost button-wide" onClick={onPass}>Pass this auction</button>
    </Modal>
  );
}
