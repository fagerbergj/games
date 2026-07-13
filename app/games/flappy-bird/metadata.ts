import { registerGame } from "@/app/games";

registerGame({
  id: "flappy-bird",
  title: "Flappy Bird",
  description: "Navigate through pipes by tapping to flap",
  thumbnail: "/games/flappy-bird/thumbnail.png",
  players: [1],
  difficulty: "easy",
  duration: "5-10",
});

export const games = [];
