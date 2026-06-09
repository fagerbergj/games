"use client";

import { useEffect, useState } from "react";

export interface GameMetadata {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  players: number[];
  difficulty: string;
  duration: string;
}

export function useGames() {
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
        
        const gamesList = (window as any).__games__ || [];
        setGames(gamesList);
      } catch (error) {
        console.error("Error loading game metadata:", error);
      }
    }
    
    loadGames();
  }, []);

  return games;
}
