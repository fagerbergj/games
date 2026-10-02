import { registerGame } from "@/app/games";

registerGame({
  id: "blackjack/multiplayer",
  title: "Blackjack (multiplayer)",
  description: "Share a table with friends: one room code, up to five seats.",
  thumbnail: "/games/blackjack/thumbnail.png",
  players: [1, 2, 3, 4, 5],
  difficulty: "easy",
  duration: "5-10",
});
