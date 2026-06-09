import { Card } from "@/app/games/kings-corner/lib/types";

const suitColors: Record<string, string> = {
  hearts: "text-red-600",
  diamonds: "text-red-600",
  clubs: "text-zinc-900",
  spades: "text-zinc-900",
};

const rankNames: Record<number, string> = {
  1: "Ace",
  11: "Jack",
  12: "Queen",
  13: "King",
};

export function CardInfo({ card }: { card: Card }) {
  const rank = rankNames[card.rank] || card.rank.toString();
  const suitSymbol: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };

  return (
    <div className="bg-zinc-800 rounded-xl p-4 flex items-center gap-4">
      <div className="flex-shrink-0">
        <div className="w-12 h-16 bg-white rounded shadow flex items-center justify-center">
          <span className={`text-xl ${suitColors[card.suit]}`}>
            {suitSymbol[card.suit]}
          </span>
        </div>
      </div>
      <div>
        <h3 className="text-white font-bold">{rank} of {card.suit}</h3>
        <p className="text-zinc-400 text-sm">Rank: {card.rank}</p>
      </div>
    </div>
  );
}
