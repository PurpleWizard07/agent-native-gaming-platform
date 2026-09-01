import type { Game } from "../data/games";
import { coverShapes, coverStops } from "../lib/coverArt";

// Original, procedurally generated cover art — a per-game gradient, a
// genre-driven geometric motif, and typography — instead of licensed or
// copied storefront artwork. See src/lib/coverArt.ts for the motif system.
export function GameCover({ game, className = "" }: { game: Game; className?: string }) {
  const { from, to } = coverStops(game.accent);
  const shapes = coverShapes(game);

  return (
    <div
      className={`relative flex items-end overflow-hidden rounded-lg ${className}`}
      style={{ background: `linear-gradient(155deg, ${from}, ${to})` }}
    >
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {shapes.map((shape, i) => {
          const { kind, attrs } = shape;
          if (kind === "circle") return <circle key={i} {...attrs} />;
          if (kind === "path") return <path key={i} {...attrs} />;
          if (kind === "line") return <line key={i} {...attrs} />;
          return <polygon key={i} {...attrs} />;
        })}
      </svg>
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
      <span className="relative z-10 p-3 text-sm font-semibold leading-tight text-white drop-shadow-sm">{game.title}</span>
    </div>
  );
}
