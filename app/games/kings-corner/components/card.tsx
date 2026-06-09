"use client";

import { Card } from "../lib/types";

export default function CardComponent({
  card,
  onClick,
  faceUp = true,
  selected = false,
  className = "",
  draggable = false,
  onDragStart,
}: {
  card: Card;
  onClick?: () => void;
  faceUp?: boolean;
  selected?: boolean;
  className?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  const suitSymbols: Record<string, string> = {
    hearts: "♥",
    diamonds: "♦",
    clubs: "♣",
    spades: "♠",
  };

  const rankSymbols: Record<number, string> = {
    1: "A",
    11: "J",
    12: "Q",
    13: "K",
  };

  const rank = rankSymbols[card.rank] || card.rank.toString();
  const suit = suitSymbols[card.suit] || card.suit;

  const isRed = card.suit === "hearts" || card.suit === "diamonds";

  if (!faceUp) {
    return (
      <div
        className={`w-20 h-28 bg-zinc-800 border-2 border-zinc-600 rounded-lg shadow-md flex items-center justify-center ${className}`}
      >
        <div className="w-16 h-24 border border-zinc-700 rounded" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      className={`
        relative w-20 h-28 bg-white border border-zinc-200 rounded-lg shadow-md
        cursor-pointer transition-all duration-200 hover:scale-105
        ${selected ? "ring-2 ring-blue-400 -translate-y-2" : ""}
        ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
        ${className}
      `}
    >
      <div className="absolute top-1 left-1 flex flex-col items-center">
        <span className={`text-xs font-bold ${isRed ? "text-red-600" : "text-zinc-900"}`}>
          {rank}
        </span>
        <span className={`text-xs ${isRed ? "text-red-600" : "text-zinc-900"}`}>
          {suit}
        </span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-2xl ${isRed ? "text-red-600" : "text-zinc-900"}`}>
          {suit}
        </span>
      </div>
      <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180">
        <span className={`text-xs font-bold ${isRed ? "text-red-600" : "text-zinc-900"}`}>
          {rank}
        </span>
        <span className={`text-xs ${isRed ? "text-red-600" : "text-zinc-900"}`}>
          {suit}
        </span>
      </div>
    </div>
  );
}
