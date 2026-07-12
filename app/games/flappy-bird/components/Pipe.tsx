import { PIPE_WIDTH } from "../lib/game";

export function Pipe({ x, gapY }: { x: number; gapY: number }) {
  return (
    <>
      {/* Top pipe */}
      <div
        className="absolute z-10"
        style={{
          left: x,
          top: 0,
          width: PIPE_WIDTH,
          height: gapY - 70 / 2,
          background: "linear-gradient(90deg, #2e7d32 0%, #4caf50 50%, #2e7d32 100%)",
          borderLeft: "2px solid #1b5e20",
          borderRight: "2px solid #1b5e20",
        }}
      >
        {/* Pipe cap */}
        <div
          className="absolute bottom-[-2px] left-[-3px] w-[calc(100%+6px)] h-4 bg-green-600 rounded-sm border border-green-800"
        />
      </div>

      {/* Bottom pipe */}
      <div
        className="absolute z-10"
        style={{
          left: x,
          top: gapY + 70 / 2,
          width: PIPE_WIDTH,
          bottom: "60px",
          background: "linear-gradient(90deg, #2e7d32 0%, #4caf50 50%, #2e7d32 100%)",
          borderLeft: "2px solid #1b5e20",
          borderRight: "2px solid #1b5e20",
        }}
      >
        {/* Pipe cap */}
        <div className="absolute top-[-2px] left-[-3px] w-[calc(100%+6px)] h-4 bg-green-600 rounded-sm border border-green-800" />
      </div>
    </>
  );
}
