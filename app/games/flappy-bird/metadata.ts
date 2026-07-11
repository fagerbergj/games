import { registerGame } from "@/app/games";

registerGame({
  id: "flappy-bird",
  title: "Flappy Bird",
  description: "Tap or press space to flap — dodge the pipes!",
  thumbnail: "/games/flappy-bird/thumbnail.png",
  players: [1],
  difficulty: "easy",
  duration: "5-10",
});

export const games = [];
