import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { InitializingScreen } from "./components/InitializingScreen";
import { PlayerSetupModal } from "./components/PlayerSetupModal";
import { GamePage } from "./pages/GamePage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import type { Player } from "./types/game";

type Screen = "login" | "signup" | "setup" | "initializing" | "game";

const playerColors = ["#55D6E8", "#7C4DFF", "#FF5E78", "#F7B731"];

const shuffle = <T,>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

const createPlayers = (names: string[]): Player[] => {
  const colors = shuffle(playerColors);
  return names.map((name, index) => ({
    id: `player-${Date.now()}-${index}`,
    name,
    color: colors[index],
    money: 1500,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    bankrupt: false,
  }));
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameKey, setGameKey] = useState(0);

  const beginSetup = () => setScreen("setup");
  const initialize = (names: string[]) => {
    setPlayers(createPlayers(names));
    setScreen("initializing");
  };

  const playAgain = () => {
    setPlayers(createPlayers(players.map((player) => player.name)));
    setGameKey((key) => key + 1);
    setScreen("initializing");
  };

  return (
    <main className="app-shell">
      <AnimatePresence mode="wait">
        {screen === "login" && <LoginPage key="login" onLogin={beginSetup} onSignup={() => setScreen("signup")} />}
        {screen === "signup" && <SignupPage key="signup" onSuccess={beginSetup} onLogin={() => setScreen("login")} />}
        {screen === "setup" && <PlayerSetupModal key="setup" onStart={initialize} onBack={() => setScreen("login")} />}
        {screen === "initializing" && (
          <InitializingScreen
            key={`initializing-${gameKey}`}
            players={players}
            onComplete={(orderedPlayers) => {
              setPlayers(orderedPlayers);
              setScreen("game");
            }}
          />
        )}
        {screen === "game" && (
          <GamePage
            key={`game-${gameKey}`}
            players={players}
            onPlayAgain={playAgain}
            onReturnToLogin={() => setScreen("login")}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
