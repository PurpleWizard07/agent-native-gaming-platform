import type { Game } from "../data/games";
import { shade } from "../lib/color";

// Original, procedurally generated cover art — a per-game gradient plus
// typography — instead of licensed or copied storefront artwork.
export function GameCover({ game, className = "" }: { game: Game; className?: string }) {
  const from = shade(game.accent, 8);
  const to = shade(game.accent, -32);

  return (
    <div
      className={`relative flex items-end overflow-hidden rounded-lg ${className}`}
      style={{ background: `linear-gradient(155deg, ${from}, ${to})` }}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <span className="relative z-10 p-3 text-sm font-semibold leading-tight text-white drop-shadow-sm">{game.title}</span>
    </div>
  );
}
