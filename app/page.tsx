import { getGames } from "@/app/games";
import GameCard from "@/app/components/game-card";

export const metadata = {
  title: "Games Lobby",
  description: "Play classic card games including Kings Corner",
};

export default function Home() {
  const games = getGames();

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-center mb-12 text-zinc-900 dark:text-zinc-50">
          Games Lobby
        </h1>
        
        {games.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-zinc-600 dark:text-zinc-400">
              No games available yet. Check back soon!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
