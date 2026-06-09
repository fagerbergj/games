import type { GameMetadata } from "@/app/games";

const games: GameMetadata[] = [];

export function registerGame(game: GameMetadata) {
  games.push(game);
}

export function getGames(): GameMetadata[] {
  return games;
}

export function getGameById(id: string): GameMetadata | undefined {
  return games.find((game) => game.id === id);
}
