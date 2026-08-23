import { motion } from "framer-motion";
import { getSpace } from "../data/boardData";
import { formatMoney } from "../game/gameRules";
import type { GameState, Player } from "../types/game";
import { ActivityFeed } from "./ActivityFeed";
import { Dice } from "./Dice";

type DiceAreaProps = {
  state: GameState;
  currentPlayer: Player;
  onRoll: () => void;
  onBuy: () => void;
  onAuction: () => void;
  onEndTurn: () => void;
  onAddTime: () => void;
};

export function DiceArea({ state, currentPlayer, onRoll, onBuy, onAuction, onEndTurn, onAddTime }: DiceAreaProps) {
  const pending = state.pendingSpaceId === null ? null : getSpace(state.pendingSpaceId);
  const minutes = Math.floor(state.turnSeconds / 60);
  const seconds = `${state.turnSeconds % 60}`.padStart(2, "0");
  const timerProgress = Math.min(100, Math.max(0, (state.turnSeconds / 120) * 100));
  const canBuy = pending?.type === "property" && currentPlayer.money >= pending.price;

  return (
    <div className="dice-area">
      <div className="turn-banner"><span style={{ backgroundColor: currentPlayer.color }} /> <b>{currentPlayer.name}</b> <em>Current turn</em></div>
      <div className="turn-timer"><span className="timer-ring" style={{ background: `conic-gradient(#eea63b ${timerProgress}%, #524265 0)` }} aria-hidden="true" /> <b>{minutes}:{seconds}</b>{state.turnSeconds < 60 && <button type="button" onClick={onAddTime}>⏱ Ask for more time</button>}</div>
      <Dice dice={state.dice} rolling={state.phase === "ROLLING"} />
      <div className="dice-total">{state.phase === "ROLLING" ? "Backend rolling…" : state.dice ? `Dice total: ${state.dice[0] + state.dice[1]}` : "Waiting for the backend roll"}</div>
      <div className="center-actions">
        {state.phase === "WAITING_FOR_ROLL" && <motion.button type="button" className="button button-primary" whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} onClick={onRoll}>⚄ Roll the dice</motion.button>}
        {state.phase === "ROLLING" || state.phase === "MOVING" || state.phase === "RESOLVING_SPACE" ? <button type="button" className="button button-primary" disabled>{state.phase === "MOVING" ? "Moving token…" : "Rolling…"}</button> : null}
        {state.phase === "PROPERTY_DECISION" && pending?.type === "property" && <>
          <button type="button" className="button button-secondary" onClick={onAuction}>Decline & auction</button>
          <motion.button type="button" className="button button-primary" disabled={!canBuy} whileTap={{ scale: 0.97 }} onClick={onBuy}>＋ Buy for {formatMoney(pending.price)}</motion.button>
        </>}
        {state.phase === "WAITING_FOR_END_TURN" && <motion.button type="button" className="button button-primary" whileTap={{ scale: 0.97 }} onClick={onEndTurn}>✓ End turn</motion.button>}
        {state.phase === "JAIL_DECISION" && <span className="phase-hint">Jail decision required</span>}
        {state.rollAgain && state.phase === "WAITING_FOR_ROLL" && <span className="doubles-badge">DOUBLES — roll again!</span>}
      </div>
      <ActivityFeed entries={state.activityLog} players={state.players} />
    </div>
  );
}
