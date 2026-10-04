import { registerGame } from "@/app/games";

registerGame({
  id: "battleship",
  title: "Battleship",
  description: "Hide your fleet, hunt theirs: two players, one room code.",
  thumbnail: "/games/battleship/thumbnail.png",
  players: [2],
  difficulty: "easy",
  duration: "10-20",
});
