"use client";

import Image from "next/image";
import Link from "next/link";
import type { GameMetadata } from "@/app/games";

export default function GameCard({ game }: { game: GameMetadata }) {
  return (
    <div className="group bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden shadow-lg transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={game.thumbnail}
          alt={game.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <h2 className="absolute bottom-4 left-4 text-2xl font-bold text-white">
          {game.title}
        </h2>
      </div>
      <div className="p-6">
        <p className="text-zinc-600 dark:text-zinc-400 mb-4">
          {game.description}
        </p>
        <div className="flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-500 mb-4">
          <span>Players: {game.players.join(" - ")}</span>
          <span>Duration: {game.duration} min</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <span className="px-2 py-1 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {game.difficulty}
            </span>
          </div>
          <Link
            href={`/games/${game.id}`}
            className="py-2 px-4 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-medium transition-colors hover:bg-zinc-800 dark:hover:bg-zinc-200"
          >
            Play Now
          </Link>
        </div>
      </div>
    </div>
  );
}
