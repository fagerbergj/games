import { registerGame } from "@/app/games";

registerGame({
  id: "kings-corner",
  title: "Kings Corner",
  description: "A classic card game strategy challenge",
  thumbnail: "/games/kings-corner/thumbnail.png",
  players: [2, 3, 4],
  difficulty: "medium",
  duration: "15-30",
});

export const games = [];
