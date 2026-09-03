import { USERS } from "../data/users";
import { useSession } from "../state/SessionContext";

// Stands in for auth on a synthetic demo platform, and is what makes the
// two-window party demo possible: each browser tab keeps its own viewer
// choice (SessionProvider persists it to sessionStorage, which is per-tab).
export function UserSwitcher() {
  const { viewer, setViewerId } = useSession();

  return (
    <label className="flex items-center gap-2 text-xs text-neutral-500">
      <span className="hidden sm:inline">View as</span>
      <span
        className="h-5 w-5 shrink-0 rounded-full ring-2 ring-white/15"
        style={{ backgroundColor: viewer.avatar }}
        aria-hidden="true"
      />
      <select
        className="field py-1.5 pl-2.5 pr-7 text-xs"
        value={viewer.id}
        onChange={(e) => setViewerId(e.target.value)}
        aria-label="View as"
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
