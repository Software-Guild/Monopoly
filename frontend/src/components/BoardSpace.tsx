import { motion } from "framer-motion";
import type { BoardSpace as BoardSpaceType, Player, PropertyStatus } from "../types/game";
import { formatMoney } from "../game/gameRules";

type BoardSpaceProps = {
  space: BoardSpaceType;
  status?: PropertyStatus;
  players: Player[];
  ownerColor?: string;
  ownerName?: string;
  position: { row: number; column: number };
  onClick: () => void;
};

const cornerIds = new Set([0, 10, 20, 30]);

export function BoardSpace({ space, status, players, ownerColor, ownerName, position, onClick }: BoardSpaceProps) {
  const side = space.id > 10 && space.id < 20 ? "right" : space.id > 30 ? "left" : space.id > 20 && space.id < 30 ? "bottom" : "top";
  const actionClass = space.type === "surprise" ? "space-surprise" : space.type === "treasure" ? "space-treasure" : space.type === "tax" ? "space-tax" : "";

  return (
    <motion.button
      type="button"
      className={`board-space side-${side} ${cornerIds.has(space.id) ? "corner-space" : ""} ${actionClass} ${status?.ownerId ? "owned-space" : ""} ${status?.mortgaged ? "is-mortgaged" : ""}`}
      style={{ gridRow: position.row, gridColumn: position.column }}
      whileHover={{ zIndex: 8, scale: 1.055 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      title={space.name}
    >
      {space.type === "property" && <span className="group-band" style={{ backgroundColor: space.groupColor }} />}
      {status?.mortgaged && <span className="mortgage-stamp">MORTGAGED</span>}
      <span className="space-icon" aria-hidden="true">{space.icon ?? (space.type === "property" && space.propertyKind === "site" ? "●" : "")}</span>
      <span className="space-name">{space.shortName ?? space.name}</span>
      {space.type === "property" && <span className="space-price">{formatMoney(space.price)}</span>}
      {space.type === "tax" && <span className="space-price">{formatMoney(space.amount ?? 0)}</span>}
      {status && (status.hotel || status.houses > 0) && <span className="building-row" aria-label={status.hotel ? "Hotel" : `${status.houses} houses`}>{status.hotel ? "🏨" : "▰".repeat(status.houses)}</span>}
      {status?.ownerId && <>
        <span className="ownership-outline" style={{ borderColor: ownerColor ?? "#7c4dff" }} />
        <span className="ownership-strip" style={{ backgroundColor: ownerColor ?? "#7c4dff" }} title={`Owned by ${ownerName ?? "player"}`}>{ownerName?.slice(0, 1).toUpperCase()}</span>
      </>}
      {players.length > 0 && <span className="space-tokens">
        {players.map((player) => (
          <motion.span key={player.id} layoutId={`token-${player.id}`} className="board-token" style={{ backgroundColor: player.color }} title={player.name}>
            {player.name.slice(0, 1).toUpperCase()}
          </motion.span>
        ))}
      </span>}
    </motion.button>
  );
}
