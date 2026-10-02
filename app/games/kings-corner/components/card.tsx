"use client";

import { Card } from "../lib/types";

const SUIT_SYMBOLS: Record<string, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

const RANK_SYMBOLS: Record<number, string> = {
  1: "A",
  11: "J",
  12: "Q",
  13: "K",
};

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
  const rank = RANK_SYMBOLS[card.rank] ?? String(card.rank);
  const suit = SUIT_SYMBOLS[card.suit] ?? card.suit;

  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  const textColor = isRed ? "text-red-600" : "text-zinc-900";

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
        <span className={`text-xs font-bold ${textColor}`}>
          {rank}
        </span>
        <span className={`text-xs ${textColor}`}>
          {suit}
        </span>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-2xl ${textColor}`}>
          {suit}
        </span>
      </div>
      <div className="absolute bottom-1 right-1 flex flex-col items-center rotate-180">
        <span className={`text-xs font-bold ${textColor}`}>
          {rank}
        </span>
        <span className={`text-xs ${textColor}`}>
          {suit}
        </span>
      </div>
    </div>
  );
}
