import { Link } from "react-router-dom";
import { GAME_BY_ID, GAMES, type Game } from "../data/games";
import { ownsGame } from "../data/libraries";
import { useSession } from "../state/SessionContext";
import { GameCard } from "../components/GameCard";
import { Avatar } from "../components/Avatar";

function greeting(hour: number): string {
  if (hour < 5) return "Still up";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Both limits are common multiples of every column count their grid uses (4
// over 2/4; 12 over 2/4/6), so each row is a full row at every breakpoint.
// The previous six-up grid fed by a four-item slice left two empty cells on
// every wide load, which is most of what read as "dead space".
const CONTINUE_LIMIT = 4;
const POPULAR_LIMIT = 12;

export function Home() {
  const { viewer, library, friends } = useSession();

  const continuePlaying = library
    .filter((entry) => entry.installed && !entry.completed && entry.playtimeMinutes > 0)
    .sort((a, b) => {
      if (a.lastPlayedAt === null && b.lastPlayedAt === null) return 0;
      if (a.lastPlayedAt === null) return 1;
      if (b.lastPlayedAt === null) return -1;
      return new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime();
    })
    .slice(0, CONTINUE_LIMIT)
    .map((entry) => GAME_BY_ID[entry.gameId])
    .filter(Boolean);

  const onlineCount = friends.filter((f) => f.presence === "online").length;

  // Offline friends stay in the list rather than vanishing: a sidebar that
  // empties out to a single line is the same void problem in miniature.
  const rosterByPresence = [...friends].sort((a, b) => {
    if (a.presence === b.presence) return a.name.localeCompare(b.name);
    return a.presence === "online" ? -1 : 1;
  });

  // Unowned games first, then topped up with owned ones so the row always
  // fills. Alex owns 16 of the 24, so "unowned only" could not fill a
  // twelve-card grid on its own.
  const owned = (g: Game) => ownsGame(viewer.id, g.id);
  const popularForYou = [...GAMES.filter((g) => !owned(g)), ...GAMES.filter(owned)].slice(
    0,
    POPULAR_LIMIT,
  );

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-neutral-100">
          {greeting(new Date().getHours())}, {viewer.name}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {library.length} games in your library &middot;{" "}
          {onlineCount === 0 ? "no friends online" : `${onlineCount} online now`}
        </p>
      </section>

      {/* Two columns from lg up. The roster is the reason: as a full-width
          band it was three short rows stretched across 1150px with nothing to
          their right, and it pushed the second card grid below the fold. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:gap-8">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
            Continue Playing
          </h2>
          {continuePlaying.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {continuePlaying.map((game) => (
                <GameCard key={game.id} game={game} owned />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-ink-700 px-4 py-6 text-sm text-neutral-500">
              Nothing in progress right now.{" "}
              <Link to="/library" className="text-accent-400 hover:text-accent-300">
                Open your library
              </Link>
              .
            </p>
          )}
        </section>

        <aside>
          <div className="rounded-lg border border-ink-800 bg-ink-900 shadow-card">
            <div className="flex items-baseline gap-2 border-b border-ink-800 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
                Friends
              </h2>
              <span className="text-xs text-neutral-500">{onlineCount} online</span>
              <Link
                to="/friends"
                className="ml-auto text-xs text-accent-400 hover:text-accent-300"
              >
                All
              </Link>
            </div>
            {rosterByPresence.length > 0 ? (
              <ul className="divide-y divide-ink-800">
                {rosterByPresence.map((friend) => {
                  const online = friend.presence === "online";
                  const game = friend.playingGameId ? GAME_BY_ID[friend.playingGameId] : undefined;
                  return (
                    <li key={friend.id} className="flex items-center gap-3 px-4 py-2.5">
                      <Avatar user={friend} showPresence />
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block truncate text-sm ${online ? "text-neutral-100" : "text-neutral-500"}`}
                        >
                          {friend.name}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {online ? (game ? `Playing ${game.title}` : "Online") : "Offline"}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-neutral-500">No friends yet.</p>
            )}
          </div>
        </aside>
      </div>

      {/* Full width, below the sidebar band. Nested in the left column it left
          a ~500px void to the right of itself once the roster card ran out. */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Popular For You
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {popularForYou.map((game) => (
            <GameCard key={game.id} game={game} owned={owned(game)} />
          ))}
        </div>
      </section>
    </div>
  );
}
