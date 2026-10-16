"use client";

import { useFlappyBird } from "./hooks/useFlappyBird";
import FlappyGameScreen from "./components/game-screen";

export default function FlappyBirdPage() {
  const { state, startGame, flap } = useFlappyBird();

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6">
      <FlappyGameScreen
        state={state}
        onFlap={flap}
        onStart={startGame}
      />
      <p className="text-sm text-gray-500">Click or press Space to fly</p>
    </div>
  );
}
