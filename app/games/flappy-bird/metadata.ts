import { registerGame } from "@/app/games";

registerGame({
  id: "flappy-bird",
  title: "Flappy Bird",
  description: "Tap to fly through the pipes — how far can you go?",
  thumbnail: "/games/flappy-bird/thumbnail.png",
  players: [1],
  difficulty: "easy",
  duration: "5-10",
});

export const games = [];
