"use client";

import { useState } from "react";
import type { GameMetadata } from "@/app/games";

export type { GameMetadata };

export function useGames() {
  const [games] = useState<GameMetadata[]>([]);
  return games;
}
