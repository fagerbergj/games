import { GameMetadata, registerGame } from "@/app/games";

const metadata: GameMetadata = {
  id: "flappy-bird",
  title: "Flappy Bird",
  description: "Tap to fly through the pipes. How high can you score?",
  thumbnail: "/games/flappy-bird/thumbnail.png",
  players: [1],
  difficulty: "Easy",
  duration: "~5 min",
};

registerGame(metadata);

export default metadata;
