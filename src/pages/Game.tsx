import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { GAME_BY_ID } from "../data/games";
import { ownsGame } from "../data/libraries";
import { useSession } from "../state/SessionContext";
import { useParty } from "../state/PartyContext";
import { useView } from "../state/ViewContext";
import { GameCover } from "../components/GameCover";
import { Avatar } from "../components/Avatar";
import { coopLabel, playerCountLabel, sessionLengthLabel } from "../lib/formatGame";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-xs uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className="text-sm text-neutral-200">{value}</dd>
    </div>
  );
}

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
        <Link to="/store" className="text-accent-400 hover:text-accent-300">
          Back to Store
        </Link>
      </div>
    );
  }

  const owned = library.some((e) => e.gameId === game.id);
  const owningFriends = friends.filter((f) => ownsGame(f.id, game.id));

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-neutral-100">{game.title}</h1>
        <div className="flex flex-wrap gap-1.5">
          {game.genres.map((genre) => (
            <span
              key={genre}
              className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-neutral-300"
            >
              {genre}
            </span>
          ))}
        </div>
      </section>

      {/* Art left, action panel right, from lg up. As a single stacked column
          the Play button ended up alone at the bottom of a 1150px-wide page
          under five thin one-line sections. */}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <GameCover game={game} className="aspect-[16/9] w-full" />
          <p className="text-neutral-300">{game.description}</p>
        </div>

        <aside className="space-y-4">
          <div className="space-y-4 rounded-lg border border-ink-800 bg-ink-900 p-4 shadow-card">
            <button
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                await createParty(game.id, viewer.id);
                navigate("/party");
              }}
              className="w-full rounded-md bg-accent-400 px-4 py-2.5 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-300 disabled:opacity-50"
            >
              Play
            </button>

            {owned ? (
              <p className="text-center text-sm font-medium text-emerald-400">You own this</p>
            ) : (
              <p className="text-center text-sm text-neutral-500">Not in your library</p>
            )}

            <dl className="divide-y divide-ink-800 border-t border-ink-800 pt-1">
              <Stat label="Players" value={playerCountLabel(game)} />
              <Stat label="Session" value={sessionLengthLabel(game)} />
              <Stat label="Co-op" value={coopLabel(game)} />
            </dl>
          </div>

          <div className="rounded-lg border border-ink-800 bg-ink-900 p-4 shadow-card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
              Friends who own this
            </h2>
            {owningFriends.length === 0 ? (
              <p className="text-sm text-neutral-500">None of your friends own this yet.</p>
            ) : (
              <ul className="space-y-2">
                {owningFriends.map((friend) => (
                  <li key={friend.id} className="flex items-center gap-2.5">
                    <Avatar user={friend} showPresence />
                    <span className="truncate text-sm text-neutral-200">{friend.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
