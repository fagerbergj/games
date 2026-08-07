import { registerGame } from "@/app/games";

registerGame({
  id: "blackjack",
  title: "Blackjack",
  description: "Classic 21 — beat the dealer with betting.",
  thumbnail: "/games/blackjack/thumbnail.png",
  players: [1],
  difficulty: "easy",
  duration: "5-10",
});

export const games = [];
