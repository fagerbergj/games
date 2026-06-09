import { Card, GameState, Player } from "@/app/games/kings-corner/lib/types";
import CardComponent from "./card";

export default function GridComponent({
  gameState,
  onCardClick,
}: {
  gameState: GameState;
  onCardClick: (cardId: string) => void;
}) {
  const { players, discardPile, currentTurn } = gameState;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 flex flex-col gap-4">
        <div className="bg-green-800 rounded-2xl p-8 border-4 border-green-900 shadow-xl min-h-[400px] relative">
          <div className="absolute top-4 right-4 text-white/30 font-bold text-4xl">
            KINGS CORNER
          </div>

          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="text-center">
              <span className="block text-white/60 text-sm uppercase tracking-wider">
                Discard Pile
              </span>
              <div className="mt-2">
                {discardPile.length > 0 ? (
                  <CardComponent
                    card={discardPile[discardPile.length - 1]}
                    faceUp={true}
                  />
                ) : (
                  <div className="w-16 h-24 border-2 border-dashed border-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white/40">Empty</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {players.map((player, index) => (
              <div
                key={player.id}
                className={`
                  p-4 rounded-xl transition-all
                  ${index === currentTurn
                    ? "bg-green-700 ring-2 ring-blue-400"
                    : "bg-green-900/50 opacity-80"
                  }
                `}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`font-bold ${index === currentTurn ? "text-white" : "text-green-100"}`}>
                    {player.name}
                  </span>
                  <span className={`px-2 py-1 rounded text-sm ${index === currentTurn ? "bg-blue-500 text-white" : "bg-green-950 text-green-200"}`}>
                    {player.hand.length} cards
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 justify-center">
                  {player.hand.slice(-5).map((card) => (
                    <CardComponent
                      key={card.id}
                      card={card}
                      onClick={() => onCardClick(card.id)}
                      faceUp={true}
                      className="w-10 h-14 text-xs"
                    />
                  ))}
                  {player.hand.length > 5 && (
                    <div className="w-10 h-14 bg-zinc-800 rounded border border-zinc-600 flex items-center justify-center">
                      <span className="text-white text-xs">+{player.hand.length - 5}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-zinc-900 rounded-2xl p-6 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-4">Deck</h3>
          <div className="flex items-center justify-center gap-2 mb-4">
            {gameState.deck.length}
            <span className="text-zinc-400">cards remaining</span>
          </div>
          <div className="flex items-center justify-center">
            <div className="w-16 h-24 bg-zinc-700 rounded-lg shadow-inner flex items-center justify-center">
              <div className="w-12 h-20 bg-zinc-600 rounded border border-zinc-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
