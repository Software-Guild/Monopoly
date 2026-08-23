import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { AuctionModal } from "../components/AuctionModal";
import { Board } from "../components/Board";
import { Brand } from "../components/Brand";
import { DiceArea } from "../components/DiceArea";
import { BankruptcyModal, CardModal, DebtModal, JailModal, WinnerModal } from "../components/GameModals";
import { PlayerSidebar } from "../components/PlayerSidebar";
import { PropertyModal } from "../components/PropertyModal";
import { TradeModal } from "../components/TradeModal";
import { getSpace } from "../data/boardData";
import { useGameState } from "../hooks/useGameState";
import type { Player, PropertySpace } from "../types/game";

type GamePageProps = {
  players: Player[];
  onPlayAgain: () => void;
  onReturnToLogin: () => void;
};

export function GamePage({ players, onPlayAgain, onReturnToLogin }: GamePageProps) {
  const game = useGameState(players);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bankruptcyOpen, setBankruptcyOpen] = useState(false);
  const detailSpace = useMemo(() => {
    const id = game.state.pendingSpaceId ?? game.state.selectedSpaceId;
    if (id === null) return null;
    const space = getSpace(id);
    return space.type === "property" ? space : null;
  }, [game.state.pendingSpaceId, game.state.selectedSpaceId]);
  const mandatoryPropertyDecision = game.state.phase === "PROPERTY_DECISION" && game.state.pendingSpaceId !== null;
  const winner = game.state.players.find((player) => player.id === game.state.winnerId);

  const chooseBoardSpace = (spaceId: number) => {
    const space = getSpace(spaceId);
    if (space.type === "property") game.selectSpace(spaceId);
  };

  const propertyAction = (action: "build" | "sell" | "mortgage" | "unmortgage", space: PropertySpace) => game.propertyAction(action, space);

  return (
    <motion.div className="game-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <header className="mobile-game-header"><Brand compact /><div><span style={{ backgroundColor: game.currentPlayer.color }} />{game.currentPlayer.name}</div><button type="button" onClick={() => setSidebarOpen(true)}>Players ☰</button></header>
      <div className="game-layout">
        <section className="board-column">
          <Board state={game.state} onSelectSpace={chooseBoardSpace}>
            <DiceArea state={game.state} currentPlayer={game.currentPlayer} onRoll={game.rollDice} onBuy={game.buyPendingProperty} onAuction={game.startAuction} onEndTurn={game.endTurn} onAddTime={game.addTime} />
          </Board>
        </section>
        <PlayerSidebar state={game.state} currentPlayer={game.currentPlayer} ownedPropertyIds={game.ownedPropertyIds} open={sidebarOpen} onClose={() => setSidebarOpen(false)} onTrade={() => game.openTrade()} onSelectProperty={(spaceId) => { game.selectSpace(spaceId); setSidebarOpen(false); }} onBankrupt={() => setBankruptcyOpen(true)} />
      </div>
      {sidebarOpen && <button type="button" className="sidebar-scrim" aria-label="Close players panel" onClick={() => setSidebarOpen(false)} />}

      <PropertyModal space={detailSpace} state={game.state} currentPlayer={game.currentPlayer} mandatory={mandatoryPropertyDecision} onClose={() => game.selectSpace(null)} onBuy={game.buyPendingProperty} onAuction={game.startAuction} onAction={propertyAction} />
      <AuctionModal state={game.state} onBid={game.auctionBid} onPass={game.auctionPass} />
      <TradeModal state={game.state} tradeableProperties={game.tradeableProperties} onChange={game.updateTrade} onSend={game.sendTrade} onAccept={game.acceptTrade} onDecline={game.declineTrade} onNegotiate={game.negotiateTrade} onClose={game.closeTrade} />
      <CardModal card={game.drawnCard} onContinue={game.handleCard} />
      <JailModal player={game.currentPlayer} phase={game.state.phase} onPay={game.jailPay} onCard={game.jailUseCard} onRoll={game.jailRoll} />
      <DebtModal state={game.state} player={game.currentPlayer} onPropertyAction={(action, space) => game.propertyAction(action, space)} onSettle={game.settleDebt} onBankrupt={() => setBankruptcyOpen(true)} />
      <BankruptcyModal open={bankruptcyOpen} player={game.currentPlayer} onClose={() => setBankruptcyOpen(false)} onConfirm={() => { game.bankrupt(); setBankruptcyOpen(false); }} />
      <WinnerModal winner={winner} state={game.state} onPlayAgain={onPlayAgain} onLogin={onReturnToLogin} />
    </motion.div>
  );
}
