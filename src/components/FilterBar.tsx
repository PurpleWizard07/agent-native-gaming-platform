import type { Filters } from "../state/ViewContext";

const PLAYER_OPTIONS = [
  { label: "Any players", value: undefined },
  { label: "2+ players", value: 2 },
  { label: "3+ players", value: 3 },
  { label: "4+ players", value: 4 },
];

const SESSION_OPTIONS = [
  { label: "Any length", value: undefined },
  { label: "Under 30 min", value: 30 },
  { label: "Under 60 min", value: 60 },
  { label: "Under 90 min", value: 90 },
  { label: "Under 2 hours", value: 120 },
];

interface FilterBarProps {
  genres: string[];
  filters: Filters;
  onChange: (updater: Filters | ((prev: Filters) => Filters)) => void;
  /** Library page adds "unplayed" / "installed" toggles Store doesn't have. */
  libraryToggles?: boolean;
}

export function FilterBar({ genres, filters, onChange, libraryToggles }: FilterBarProps) {
  const toggleGenre = (genre: string) => {
    onChange((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre) ? prev.genres.filter((g) => g !== genre) : [...prev.genres, genre],
    }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-4">
      <div className="flex flex-wrap gap-1.5">
        {genres.map((genre) => {
          const active = filters.genres.includes(genre);
          return (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active ? "bg-violet-600 text-white" : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>

      <select
        className="ml-auto rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
        value={filters.minPlayers ?? ""}
        onChange={(e) => onChange((prev) => ({ ...prev, minPlayers: e.target.value ? Number(e.target.value) : undefined }))}
      >
        {PLAYER_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value ?? ""}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
        value={filters.maxSessionMinutes ?? ""}
        onChange={(e) => onChange((prev) => ({ ...prev, maxSessionMinutes: e.target.value ? Number(e.target.value) : undefined }))}
      >
        {SESSION_OPTIONS.map((opt) => (
          <option key={opt.label} value={opt.value ?? ""}>
            {opt.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-xs text-neutral-300">
        <input
          type="checkbox"
          checked={!!filters.coop}
          onChange={(e) => onChange((prev) => ({ ...prev, coop: e.target.checked || undefined }))}
        />
        Co-op only
      </label>

      {libraryToggles && (
        <>
          <label className="flex items-center gap-1.5 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={!!filters.onlyUnfinished}
              onChange={(e) => onChange((prev) => ({ ...prev, onlyUnfinished: e.target.checked || undefined }))}
            />
            Unplayed only
          </label>
          <label className="flex items-center gap-1.5 text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={!!filters.onlyInstalled}
              onChange={(e) => onChange((prev) => ({ ...prev, onlyInstalled: e.target.checked || undefined }))}
            />
            Installed only
          </label>
        </>
      )}

      {(filters.genres.length > 0 || filters.minPlayers || filters.coop || filters.maxSessionMinutes || filters.onlyUnfinished || filters.onlyInstalled) && (
        <button onClick={() => onChange({ genres: [] })} className="text-xs text-neutral-500 underline hover:text-neutral-300">
          Clear
        </button>
      )}
    </div>
  );
}
