import { BIRD_SIZE } from "../lib/game";

export function Bird({ y, rotation }: { y: number; rotation: number }) {
  return (
    <div
      className="absolute z-20"
      style={{
        left: "8%",
        top: y,
        width: BIRD_SIZE,
        height: BIRD_SIZE,
        transform: `rotate(${rotation}deg)`,
        transition: "transform 0.15s ease-out",
      }}
    >
      <div className="w-full h-full bg-yellow-400 rounded-full shadow-md relative">
        {/* Eye */}
        <div className="absolute top-[3px] right-[6px] w-3 h-3 bg-white rounded-full">
          <div className="absolute top-[2px] right-[1px] w-1.5 h-1.5 bg-gray-900 rounded-full" />
        </div>
        {/* Wing */}
        <div className="absolute top-[12px] left-0 w-4 h-3 bg-yellow-300 rounded-full -translate-y-1/2" />
        {/* Beak */}
        <div className="absolute top-[8px] right-[-6px] w-3 h-2 bg-orange-500 rounded-r-md" />
      </div>
    </div>
  );
}
