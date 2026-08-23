import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { InitializationRoll, Player } from "../types/game";
import { Brand } from "./Brand";

type InitializingScreenProps = {
  players: Player[];
  onComplete: (orderedPlayers: Player[]) => void;
};

const roll = (): [number, number] => [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];

export function InitializingScreen({ players, onComplete }: InitializingScreenProps) {
  const [rolls, setRolls] = useState<InitializationRoll[]>([]);
  const [message, setMessage] = useState("Determining player order…");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    const run = async () => {
      const initial = players.map((player) => {
        const dice = roll();
        return { playerId: player.id, dice, total: dice[0] + dice[1] };
      });
      for (let index = 0; index < initial.length; index += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        if (cancelled) return;
        setRolls(initial.slice(0, index + 1));
      }
      let contenders = initial;
      let highest = Math.max(...contenders.map((item) => item.total));
      contenders = contenders.filter((item) => item.total === highest);
      while (contenders.length > 1) {
        setMessage(`${contenders.length} players tied — rolling again…`);
        await new Promise((resolve) => window.setTimeout(resolve, 700));
        contenders = contenders.map((item) => {
          const dice = roll();
          return { ...item, dice, total: dice[0] + dice[1] };
        });
        setRolls((current) => current.map((item) => contenders.find((candidate) => candidate.playerId === item.playerId) ?? item));
        highest = Math.max(...contenders.map((item) => item.total));
        contenders = contenders.filter((item) => item.total === highest);
      }
      const winner = contenders[0];
      const firstIndex = players.findIndex((player) => player.id === winner.playerId);
      const ordered = [...players.slice(firstIndex), ...players.slice(0, firstIndex)];
      setMessage(`${ordered[0].name} goes first!`);
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      if (!cancelled) onComplete(ordered);
    };
    void run();
    return () => { cancelled = true; };
  }, [onComplete, players]);

  return (
    <motion.section className="initializing-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Brand compact />
      <div className="order-card">
        <div className="order-dice" aria-hidden="true"><motion.span animate={{ rotate: [0, 160, 350] }} transition={{ repeat: Infinity, duration: 1.2 }}>⚄</motion.span><motion.span animate={{ rotate: [0, -180, -360] }} transition={{ repeat: Infinity, duration: 1.1 }}>⚂</motion.span></div>
        <span className="eyebrow">GAME INITIALIZATION</span>
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
      </div>
    </motion.section>
  );
}
