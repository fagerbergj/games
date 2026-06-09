"use client";

export function CardAnimation({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "flip" | "deal" | "play";
}) {
  const animationClass: Record<string, string> = {
    default: "card-deal",
    flip: "card-flip",
    deal: "card-deal",
    play: "card-play",
  };

  return (
    <div className={animationClass[variant]}>
      {children}
    </div>
  );
}

export function TableShake({
  isShaking,
  children,
}: {
  isShaking: boolean;
  children: React.ReactNode;
}) {
  if (!isShaking) return <>{children}</>;

  return (
    <div className="table-shake">
      {children}
    </div>
  );
}

export function CardDealSequence({
  cards,
  delay = 100,
}: {
  cards: React.ReactNode[];
  delay?: number;
}) {
  return (
    <>
      {cards.map((card, index) => (
        <div
          key={index}
          style={{
            animation: `cardDeal 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) ${index * (delay / 1000)}s both`,
          }}
        >
          {card}
        </div>
      ))}
    </>
  );
}

export function WinCelebration({ winner }: { winner: string }) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="text-center animate-winCelebration">
        <div className="animate-bounce">
          <h1 className="text-6xl font-bold text-yellow-400 mb-4">
            {winner} Wins!
          </h1>
        </div>
      </div>
    </div>
  );
}
