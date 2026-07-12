import { registerGame } from "@/app/games";

registerGame({
  id: "flappy-bird",
  title: "Flappy Bird",
  description: "Tap to fly through the pipes. Avoid collisions!",
  thumbnail: "/games/flappy-bird/thumbnail.png", // Placeholder
  players: [1],
  difficulty: "medium",
  duration: "5-10",
});
