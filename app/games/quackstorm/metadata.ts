import { registerGame } from "@/app/games";

registerGame({
  id: "quackstorm",
  title: "Quackstorm",
  description: "Aim a bread cannon, send ducklings through lily-pad math gates and storm the Goose Keep.",
  thumbnail: "/games/quackstorm/thumbnail.png",
  players: [1],
  difficulty: "medium",
  duration: "1-6",
});

export const games = [];
