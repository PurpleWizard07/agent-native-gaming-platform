import { USERS } from "../data/users";
import { useSession } from "../state/SessionContext";

// Stands in for auth on a synthetic demo platform, and is what makes the
// two-window party demo possible: each browser tab keeps its own viewer
// choice (SessionProvider persists it to sessionStorage, which is per-tab).
export function UserSwitcher() {
  const { viewer, setViewerId } = useSession();

  return (
    <label className="flex items-center gap-2 text-xs text-neutral-400">
      View as
      <select
        className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
        value={viewer.id}
        onChange={(e) => setViewerId(e.target.value)}
      >
        {USERS.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}
