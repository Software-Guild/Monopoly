import type { ReactNode } from "react";
import { boardData } from "../data/boardData";
import type { GameState } from "../types/game";
import { BoardSpace } from "./BoardSpace";

type BoardProps = {
  state: GameState;
  onSelectSpace: (spaceId: number) => void;
  children: ReactNode;
};

export const getBoardPosition = (id: number): { row: number; column: number } => {
  if (id === 0) return { row: 1, column: 1 };
  if (id < 10) return { row: 1, column: id + 1 };
  if (id === 10) return { row: 1, column: 11 };
  if (id < 20) return { row: id - 9, column: 11 };
  if (id === 20) return { row: 11, column: 11 };
  if (id < 30) return { row: 11, column: 31 - id };
  if (id === 30) return { row: 11, column: 1 };
  return { row: 41 - id, column: 1 };
};

export function Board({ state, onSelectSpace, children }: BoardProps) {
  return (
    <div className="board-frame">
      <div className="board-grid">
        {boardData.map((space) => (
          <BoardSpace
            key={space.id}
            space={space}
            status={space.type === "property" ? state.properties[space.id] : undefined}
            players={state.players.filter((player) => player.position === space.id && !player.bankrupt)}
            position={getBoardPosition(space.id)}
            onClick={() => onSelectSpace(space.id)}
          />
        ))}
        <section className="board-center">
          <div className="board-watermark" aria-hidden="true">
            <span>INDIA</span>
            <b>TYCOON</b>
          </div>
          {children}
        </section>
      </div>
    </div>
  );
}
