export interface GameMetadata {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  players: number[];
  difficulty: string;
  duration: string;
}

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
