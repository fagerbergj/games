import type { Card, GameState } from "../lib/types";
import { getCardSymbol } from "../lib/deck";
import { getPairRank, getRankCounts } from "../lib/positions";

const CELL = "py-1 px-3 text-center text-sm font-bold text-white";

function BoardCell({ positions }: { positions: string[] }) {
  return <td className={CELL}>{positions.length === 0 ? "—" : positions.join(" ")}</td>;
}

export default function CardPlacementHint({ card, gameState }: { card: Card; gameState: GameState }) {
  const mine = getRankCounts(card.rank, gameState);
  const pairRank = getPairRank(card.rank);
  const pair = pairRank !== null ? getRankCounts(pairRank, gameState) : null;
  const pairSymbol = pairRank !== null ? getCardSymbol(pairRank) : null;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-xs shadow-xl min-w-[160px]">
      <table className="w-full">
        <thead>
          <tr>
            <th className="pb-1 text-left text-zinc-500 font-normal"></th>
            <th className="pb-1 px-3 text-center text-zinc-300 font-bold">{getCardSymbol(card.rank)}</th>
            {pairSymbol && <th className="pb-1 px-3 text-center text-zinc-400 font-normal">pair ({pairSymbol})</th>}
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-zinc-700">
            <td className="py-1 pr-3 text-zinc-500">Board</td>
            <BoardCell positions={mine.boardPositions} />
            {pair && <BoardCell positions={pair.boardPositions} />}
          </tr>
          <tr className="border-t border-zinc-700">
            <td className="py-1 pr-3 text-zinc-500">Discard</td>
            <td className={CELL}>{mine.discard || "—"}</td>
            {pair && <td className={CELL}>{pair.discard || "—"}</td>}
          </tr>
          <tr className="border-t border-zinc-700">
            <td className="py-1 pr-3 text-zinc-500">Deck</td>
            <td className={CELL}>{mine.deck}</td>
            {pair && <td className={CELL}>{pair.deck}</td>}
          </tr>
        </tbody>
      </table>
      {card.rank === 10 && <p className="text-zinc-500 text-center mt-1">self-clearing</p>}
    </div>
  );
}
