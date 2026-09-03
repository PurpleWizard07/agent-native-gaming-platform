import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GAME_BY_ID } from "../data/games";
import { ownsGame } from "../data/libraries";
import { useSession } from "../state/SessionContext";
import { useParty } from "../state/PartyContext";
import { useView } from "../state/ViewContext";
import { GameCover } from "../components/GameCover";
import { Avatar } from "../components/Avatar";
import { playerCountLabel, sessionLengthLabel } from "../lib/formatGame";

export function GamePage() {
  const { gameId } = useParams();
  const game = gameId ? GAME_BY_ID[gameId] : undefined;
  const { viewer, library, friends } = useSession();
  const { createParty } = useParty();
  const { setSelectedGameId } = useView();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  // Publish the game in focus so get_current_view can answer "this game" while
  // the player is here. This page is the sole owner of that value, so it also
  // clears it on the way out rather than leaving a stale id behind.
  useEffect(() => {
    if (!game) return;
    setSelectedGameId(game.id);
    return () => setSelectedGameId(null);
  }, [game, setSelectedGameId]);

  if (!game) {
    return (
      <div className="space-y-4">
        <p className="text-neutral-400">Game not found.</p>
        <Link to="/store" className="text-violet-400 hover:text-violet-300">
          Back to Store
        </Link>
      </div>
    );
  }

  const owned = library.some((e) => e.gameId === game.id);
  const owningFriends = friends.filter((f) => ownsGame(f.id, game.id));

  const playerLabel = playerCountLabel(game);
  const sessionLabel = sessionLengthLabel(game);

  const coopLabel =
    game.coopModes.length === 0
      ? "No co-op"
      : `Co-op: ${game.coopModes.join(", ")}`;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <GameCover game={game} className="aspect-[16/7] w-full" />
        <h1 className="text-2xl font-bold text-neutral-100">{game.title}</h1>
        <div className="flex flex-wrap gap-1.5">
          {game.genres.map((genre) => (
            <span
              key={genre}
              className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-300"
            >
              {genre}
            </span>
          ))}
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <span className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300">
          {playerLabel}
        </span>
        <span className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300">
          {sessionLabel}
        </span>
        <span className="rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300">
          {coopLabel}
        </span>
      </section>

      <section>
        <p className="text-neutral-300">{game.description}</p>
      </section>

      <section>
        {owned ? (
          <p className="font-medium text-emerald-400">You own this</p>
        ) : (
          <p className="text-neutral-500">Not in your library</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Friends who own this
        </h2>
        {owningFriends.length === 0 ? (
          <p className="text-neutral-500">None of your friends own this yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {owningFriends.map((friend) => (
              <span
                key={friend.id}
                className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300"
              >
                <Avatar user={friend} showPresence />
                {friend.name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section>
        <button
          disabled={starting}
          onClick={async () => {
            setStarting(true);
            await createParty(game.id, viewer.id);
            navigate("/party");
          }}
          className="inline-block rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Play
        </button>
      </section>
    </div>
  );
}
