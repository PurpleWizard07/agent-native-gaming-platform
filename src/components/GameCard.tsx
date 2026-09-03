import { Link } from "react-router-dom";
import type { Game } from "../data/games";
import { GameCover } from "./GameCover";
import { playerCountLabel, sessionLengthLabel } from "../lib/formatGame";

export function GameCard({ game, owned }: { game: Game; owned?: boolean }) {
  return (
    <Link to={`/game/${game.id}`} data-game-id={game.id} className="group block">
      <GameCover
        game={game}
        className="aspect-[3/4] w-full ring-1 ring-white/5 transition-all group-hover:scale-[1.02] group-hover:ring-2 group-hover:ring-accent-400/70"
      />
      <div className="mt-2 space-y-1">
        <div className="flex flex-wrap gap-1">
          {game.genres.slice(0, 2).map((g) => (
            <span key={g} className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-neutral-300">
              {g}
            </span>
          ))}
        </div>
        <div className="text-xs text-neutral-400">
          {playerCountLabel(game)} · {sessionLengthLabel(game)}
        </div>
        {owned && <div className="text-xs font-medium text-emerald-400">You own this</div>}
      </div>
    </Link>
  );
}
