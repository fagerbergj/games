import { Card } from "../lib/types";

export default function DeckComponent({
  deck,
  onDraw,
}: {
  deck: Card[];
  onDraw: () => void;
}) {
  return (
    <div className="bg-zinc-800 rounded-2xl p-6 shadow-xl">
      <h3 className="text-xl font-bold text-white mb-4">Deck</h3>
      <div className="flex items-center justify-between mb-4">
        <span className="text-white font-bold">{deck.length} cards</span>
        <button
          onClick={onDraw}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Draw Card
        </button>
      </div>
      <div className="flex items-center justify-center gap-2">
        {deck.slice(0, 5).map((card, index) => (
          <div
            key={card.id}
            className="w-16 h-24 bg-zinc-700 rounded-lg shadow-lg -ml-12 first:ml-0 transition-all hover:scale-105"
          />
        ))}
        {deck.length > 5 && (
          <div className="w-16 h-24 bg-zinc-700 rounded-lg shadow-lg flex items-center justify-center">
            <span className="text-white text-sm">+{deck.length - 5}</span>
          </div>
        )}
      </div>
    </div>
  );
}
