import { useSession } from "../state/SessionContext";
import { GAME_BY_ID } from "../data/games";
import { Avatar } from "../components/Avatar";

export function Friends() {
  const { friends } = useSession();

  const sorted = [...friends].sort((a, b) => {
    if (a.presence === b.presence) return 0;
    return a.presence === "online" ? -1 : 1;
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold text-neutral-100 mb-4">Friends</h1>
        <div className="space-y-2">
          {sorted.map((friend) => {
            const game = friend.playingGameId ? GAME_BY_ID[friend.playingGameId] : undefined;
            const statusText =
              friend.presence === "online"
                ? game
                  ? `Playing ${game.title}`
                  : "Online"
                : "Offline";

            return (
              <div
                key={friend.id}
                className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
              >
                <Avatar user={friend} showPresence />
                <span className="font-medium text-neutral-100">{friend.name}</span>
                <span className="ml-auto text-sm text-neutral-400 truncate">{statusText}</span>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <p className="text-neutral-500 text-sm">No friends yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
