import type { User } from "../data/users";

// One avatar circle carrying the user's colour and initial, with presence as a
// badge on it. Replaces the earlier pattern of a bare colour dot *plus* a
// separate presence dot, which read as two unrelated pieces of status.
export function Avatar({ user, showPresence = false }: { user: User; showPresence?: boolean }) {
  return (
    <span className="relative shrink-0">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-black/75"
        style={{ backgroundColor: user.avatar }}
        aria-hidden="true"
      >
        {user.name.slice(0, 1).toUpperCase()}
      </span>
      {showPresence && (
        <span
          className={
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-ink-900 " +
            (user.presence === "online" ? "bg-emerald-500" : "bg-ink-600")
          }
          aria-hidden="true"
        />
      )}
    </span>
  );
}
