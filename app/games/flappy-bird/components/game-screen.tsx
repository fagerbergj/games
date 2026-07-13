import type { FlappyState } from "../lib/flappyBird";
import { BIRD_SIZE, GAME_HEIGHT, GAME_WIDTH, PIPE_GAP } from "../lib/constants";

interface FlappyGameScreenProps {
  state: FlappyState;
  onFlap: () => void;
  onStart: () => void;
}

export default function FlappyGameScreen({ state, onFlap, onStart }: FlappyGameScreenProps) {
  const { phase, bird, pipes, score } = state;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === "Space" || e.code === "ArrowUp") {
      e.preventDefault();
      if (phase === "idle" || phase === "gameover") {
        onStart();
      } else {
        onFlap();
      }
    }
  };

  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 border-green-700 cursor-pointer select-none"
      style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      onMouseDown={(e) => {
        e.preventDefault();
        if (phase === "idle" || phase === "gameover") {
          onStart();
        } else {
          onFlap();
        }
      }}
    >
      {/* Sky background */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-400 to-sky-200" />

      {/* Clouds (static decorative elements) */}
      <Cloud top={60} left={50} scale={1.2} opacity={0.7} />
      <Cloud top={120} left={250} scale={0.8} opacity={0.5} />
      <Cloud top={40} left={350} scale={1} opacity={0.6} />

      {/* Pipes */}
      {pipes.map((pipe) => (
        <div key={pipe.id}>
          {/* Top pipe */}
          <PipeComponent x={pipe.x} topHeight={pipe.topHeight} side="top" />
          {/* Bottom pipe */}
          <PipeComponent x={pipe.x} bottomY={pipe.topHeight + PIPE_GAP} side="bottom" />
        </div>
      ))}

      {/* Ground */}
      <div className="absolute bottom-0 left-0 right-0 h-[20px] bg-gradient-to-b from-green-600 to-green-800">
        <div className="w-full h-1 bg-amber-700" />
      </div>

      {/* Bird */}
      <BirdComponent y={bird.y} velocity={bird.velocity} phase={phase} />

      {/* Score (during play) */}
      {phase === "playing" && (
        <div className="absolute top-8 left-0 right-0 text-center z-10">
          <span className="text-white text-5xl font-bold drop-shadow-[0_3px_0_rgba(0,0,0,0.5)]">
            {score}
          </span>
        </div>
      )}

      {/* Idle / Start screen */}
      {phase === "idle" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
          <div className="text-center">
            <h1 className="text-5xl font-extrabold text-yellow-300 drop-shadow-[0_4px_0_rgba(0,0,0,0.5)] mb-4">
              Flappy Bird
            </h1>
            <p className="text-white text-lg drop-shadow-[0_2px_0_rgba(0,0,0,0.5)] animate-pulse">
              Click or press Space to start
            </p>
          </div>
        </div>
      )}

      {/* Game over screen */}
      {phase === "gameover" && (
        <GameOverScreen score={score} highScore={state.highScore} onStart={onStart} />
      )}
    </div>
  );
}

/* --- Sub-components --- */

function Cloud({ top, left, scale, opacity }: { top: number; left: number; scale: number; opacity: number }) {
  return (
    <div
      className="absolute text-white pointer-events-none"
      style={{ top, left, transform: `scale(${scale})`, opacity }}
    >
      <svg width={80} height={40} viewBox="0 0 80 40">
        <ellipse cx={40} cy={25} rx={35} ry={15} fill="white" />
        <ellipse cx={25} cy={20} rx={20} ry={12} fill="white" />
        <ellipse cx={55} cy={20} rx={18} ry={12} fill="white" />
      </svg>
    </div>
  );
}

function PipeComponent({
  x,
  topHeight,
  bottomY,
  side,
}: {
  x: number;
  topHeight?: number;
  bottomY?: number;
  side: "top" | "bottom";
}) {
  const isTop = side === "top";

  return (
    <div
      className="absolute"
      style={{
        left: x,
        width: PIPE_GAP / 2,
        ...(isTop
          ? { top: 0, height: topHeight }
          : { bottom: 20, top: bottomY }),
      }}
    >
      <div className="w-full h-full bg-gradient-to-b from-green-500 to-green-700 border-2 border-green-800">
        {/* Pipe cap */}
        <div
          className={`absolute left-[-4px] right-[-4px] h-6 bg-gradient-to-b ${
            isTop ? "from-green-600 to-green-500" : "from-green-700 to-green-600"
          } border-2 border-green-800`}
          style={{ [isTop ? "bottom" : "top"]: 0 }}
        />
      </div>
    </div>
  );
}

function BirdComponent({ y, velocity, phase }: { y: number; velocity: number; phase: string }) {
  const rotation =
    phase === "idle" ? 0 : Math.min(Math.max(velocity * 4, -30), 90);

  return (
    <div
      className="absolute z-10 pointer-events-none transition-none"
      style={{
        left: GAME_WIDTH / 4 - BIRD_SIZE / 2,
        top: y - BIRD_SIZE / 2,
        width: BIRD_SIZE,
        height: BIRD_SIZE,
        transform: `rotate(${rotation}deg)`,
      }}
    >
      <svg viewBox="0 0 34 34" className="w-full h-full drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">
        {/* Body */}
        <ellipse cx={17} cy={17} rx={15} ry={12} fill="#FFD700" />
        {/* Wing */}
        <ellipse cx={12} cy={19} rx={8} ry={5} fill="#FFA500" />
        {/* Eye */}
        <circle cx={24} cy={13} r={4} fill="white" />
        <circle cx={25} cy={13} r={2} fill="#1a1a1a" />
        {/* Beak */}
        <polygon points={phase === "idle" ? "29,17 35,19 29,21" : "29,17 34,20 29,22"} fill="#FF6347" />
      </svg>
    </div>
  );
}

function GameOverScreen({
  score,
  highScore,
  onStart,
}: {
  score: number;
  highScore: number;
  onStart: () => void;
}) {
  const isNewHigh = score > 0 && score >= highScore;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
      <div className="bg-amber-100 rounded-xl shadow-2xl p-8 text-center border-4 border-amber-600 max-w-[280px]">
        <h2 className="text-3xl font-extrabold text-red-600 mb-3">Game Over</h2>

        {isNewHigh && (
          <div className="bg-yellow-300 rounded-lg py-1 px-3 mb-3 animate-bounce">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
              New High Score!
            </span>
          </div>
        )}

        <div className="space-y-2 mb-6">
          <div className="bg-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700 uppercase tracking-wide">Score</p>
            <p className="text-3xl font-extrabold text-amber-900">{score}</p>
          </div>
          <div className="bg-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-700 uppercase tracking-wide">Best</p>
            <p className="text-3xl font-extrabold text-amber-900">{highScore}</p>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          className="bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg w-full transition-colors border-b-4 border-green-700"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
