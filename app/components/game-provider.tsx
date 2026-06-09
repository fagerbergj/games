"use client";

import { useEffect, useState } from "react";

interface GameMetadata {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  players: number[];
  difficulty: string;
  duration: string;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [games, setGames] = useState<GameMetadata[]>([]);

  useEffect(() => {
    async function loadGames() {
      try {
        const modules = import.meta.glob("/app/games/*/metadata.ts", {
          eager: true,
          import: "default",
        });
        
        for (const path in modules) {
          const module = modules[path as keyof typeof modules];
          if (typeof module === "function") {
            module();
          }
        }
      } catch (error) {
        console.error("Error loading game metadata:", error);
      }
    }
    
    loadGames();
  }, []);

  return <>{children}</>;
}
