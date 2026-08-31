import { GAME_BY_ID, GAMES } from "../data/games";
import { ownsGame } from "../data/libraries";
import { useSession } from "../state/SessionContext";
import { GameCard } from "../components/GameCard";

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
    .slice(0, 4)
    .map((entry) => GAME_BY_ID[entry.gameId])
    .filter(Boolean);

  const friendsOnline = friends.filter((f) => f.presence === "online");

  const notOwned = GAMES.filter((g) => !ownsGame(viewer.id, g.id));
  const popularForYou = (notOwned.length > 0 ? notOwned : GAMES).slice(0, 6);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-neutral-100">Good evening, {viewer.name}</h1>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-3">
          Continue Playing
        </h2>
        {continuePlaying.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {continuePlaying.map((game) => (
              <GameCard key={game.id} game={game} owned />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Nothing in progress right now.</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-3">
          Friends Online
        </h2>
        {friendsOnline.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
            {friendsOnline.map((friend) => (
              <div key={friend.id} className="flex items-center gap-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: friend.avatar }}
                />
                <span className="text-sm text-neutral-100">{friend.name}</span>
                <span className="text-sm text-neutral-500">
                  {friend.playingGameId
                    ? `Playing ${GAME_BY_ID[friend.playingGameId]?.title ?? ""}`
                    : "Online"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No friends online right now.</p>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400 mb-3">
          Popular For You
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {popularForYou.map((game) => (
            <GameCard key={game.id} game={game} owned={false} />
          ))}
        </div>
      </section>
    </div>
  );
}
