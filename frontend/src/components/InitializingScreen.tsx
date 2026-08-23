import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { gameApi } from "../api/gameApi";
import type { InitializationRoll, Player } from "../types/game";
import { Brand } from "./Brand";
import { Dice } from "./Dice";

type InitializingScreenProps = {
  players: Player[];
  onComplete: (orderedPlayers: Player[]) => void;
};

const wait = (duration: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, duration));

export function InitializingScreen({ players, onComplete }: InitializingScreenProps) {
  const [rolls, setRolls] = useState<InitializationRoll[]>([]);
  const [message, setMessage] = useState("Asking the backend to determine player order…");
  const [rolling, setRolling] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const orderRequestRef = useRef<{ attempt: number; request: ReturnType<typeof gameApi.order> } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setRolls([]);
      setError(null);
      setRolling(true);
      setMessage("Backend is rolling for player order…");
      try {
        if (!orderRequestRef.current || orderRequestRef.current.attempt !== attempt) {
          orderRequestRef.current = {
            attempt,
            request: gameApi.order(players.map((player) => player.id)),
          };
        }
        const result = await orderRequestRef.current.request;
        const displayed = new Map<string, InitializationRoll>();
        for (const round of result.rounds) {
          if (round.round > 1) {
            setMessage(`${round.rolls.length} players tied — backend re-roll in progress…`);
            await wait(650);
          }
          for (const roll of round.rolls) {
            if (cancelled) return;
            displayed.set(roll.playerId, {
              playerId: roll.playerId,
              dice: [roll.dice.die1, roll.dice.die2],
              total: roll.dice.total,
            });
            setRolls(players.flatMap((player) => {
              const shown = displayed.get(player.id);
              return shown ? [shown] : [];
            }));
            await wait(420);
          }
        }
        const byId = new Map(players.map((player) => [player.id, player]));
        const ordered = result.orderedPlayerIds
          .map((id) => byId.get(id))
          .filter((player): player is Player => !!player);
        if (ordered.length !== players.length) throw new Error("Backend returned an invalid player order");
        setRolling(false);
        setMessage(`${ordered[0].name} goes first!`);
        await wait(1100);
        if (!cancelled) onComplete(ordered);
      } catch (reason) {
        if (cancelled) return;
        setRolling(false);
        const text = reason instanceof Error ? reason.message : "Could not reach the backend";
        setError(text);
        setMessage("Player order could not be initialized");
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [attempt, onComplete, players]);

  const latestDice = rolls.length ? rolls[rolls.length - 1]!.dice : null;

  return (
    <motion.section className="initializing-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Brand compact />
      <div className="order-card">
        <div className="order-dice" aria-hidden="true"><Dice dice={latestDice} rolling={rolling} /></div>
        <span className="eyebrow">BACKEND GAME INITIALIZATION</span>
        <h1>{message}</h1>
        <div className="order-rolls">
          {players.map((player) => {
            const result = rolls.find((item) => item.playerId === player.id);
            return <motion.div key={player.id} className="order-row" initial={{ opacity: 0.45 }} animate={{ opacity: result ? 1 : 0.45, x: result ? 0 : -6 }}>
              <span className="avatar-dot" style={{ backgroundColor: player.color }}>{player.name.slice(0, 1)}</span>
              <strong>{player.name}</strong>
              <span>{result ? `${result.dice[0]} + ${result.dice[1]}` : "Waiting…"}</span>
              <b>{result?.total ?? "—"}</b>
            </motion.div>;
          })}
        </div>
        {error && <div className="auth-error" role="alert">{error}<button type="button" className="button button-primary" onClick={() => setAttempt((value) => value + 1)}>Retry backend roll</button></div>}
      </div>
    </motion.section>
  );
}
