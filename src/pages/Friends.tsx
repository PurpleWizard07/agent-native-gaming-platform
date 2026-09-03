import { useSession } from "../state/SessionContext";
import { GAME_BY_ID } from "../data/games";
import { Avatar } from "../components/Avatar";
import type { User } from "../data/users";

function FriendRow({ friend }: { friend: User }) {
  const online = friend.presence === "online";
  const game = friend.playingGameId ? GAME_BY_ID[friend.playingGameId] : undefined;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <Avatar user={friend} showPresence />
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${online ? "text-neutral-100" : "text-neutral-400"}`}>
          {friend.name}
        </span>
        <span className="block truncate text-sm text-neutral-500">
          {online ? (game ? `Playing ${game.title}` : "Online") : "Offline"}
        </span>
      </span>
    </li>
  );
}

// One constrained panel rather than a full-width grid. With a handful of
// friends, a 2-up grid spanning 1150px reads as a grid that failed to fill;
// the same rows in a 40rem column read as a finished list.
export function Friends() {
  const { friends } = useSession();

  const byName = (a: User, b: User) => a.name.localeCompare(b.name);
  const online = friends.filter((f) => f.presence === "online").sort(byName);
  const offline = friends.filter((f) => f.presence !== "online").sort(byName);

  const groups = [
    { key: "online", label: "Online", members: online },
    { key: "offline", label: "Offline", members: offline },
  ].filter((group) => group.members.length > 0);

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-neutral-100">Friends</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {friends.length} friends &middot; {online.length} online
        </p>
      </section>

      {groups.length > 0 ? (
        <div className="divide-y divide-ink-800 overflow-hidden rounded-lg border border-ink-800 bg-ink-900 shadow-card">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="bg-ink-850 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {group.label} &middot; {group.members.length}
              </h2>
              <ul className="divide-y divide-ink-800">
                {group.members.map((friend) => (
                  <FriendRow key={friend.id} friend={friend} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-ink-700 px-4 py-6 text-sm text-neutral-500">
          No friends yet.
        </p>
      )}
    </div>
  );
}
