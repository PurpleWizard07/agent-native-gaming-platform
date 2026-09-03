import type { Filters } from "../state/ViewContext";

const PLAYER_OPTIONS = [
  { label: "Any players", value: undefined },
  { label: "2+ players", value: 2 },
  { label: "3+ players", value: 3 },
  { label: "4+ players", value: 4 },
];

// Labelled "About X" rather than "Under X" because a session budget tolerates
// a modest overrun — see SESSION_OVERRUN_FACTOR in src/lib/filterGames.ts.
const SESSION_OPTIONS = [
  { label: "Any length", value: undefined },
  { label: "About 30 min", value: 30 },
  { label: "About 60 min", value: 60 },
  { label: "About 90 min", value: 90 },
  { label: "About 2 hours", value: 120 },
];

interface FilterBarProps {
  genres: string[];
  filters: Filters;
  onChange: (updater: Filters | ((prev: Filters) => Filters)) => void;
  /** Library page adds completion / install toggles Store doesn't have. */
  libraryToggles?: boolean;
}

function isFiltered(filters: Filters): boolean {
  return Boolean(
    filters.query?.trim() ||
      filters.genres.length > 0 ||
      filters.minPlayers ||
      filters.coop ||
      filters.maxSessionMinutes ||
      filters.onlyUnfinished ||
      filters.onlyInstalled ||
      filters.onlyUnplayed,
  );
}

export function FilterBar({ genres, filters, onChange, libraryToggles }: FilterBarProps) {
  const toggleGenre = (genre: string) => {
    onChange((prev) => ({
      ...prev,
      genres: prev.genres.includes(genre) ? prev.genres.filter((g) => g !== genre) : [...prev.genres, genre],
    }));
  };

  return (
    <div className="space-y-3 border-b border-ink-800 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* The human's equivalent of search_games' `query` — without it the
            agent could text-search a catalog the player could only click
            through. */}
        <input
          type="search"
          aria-label="Search games"
          placeholder="Search games"
          value={filters.query ?? ""}
          onChange={(e) => onChange((prev) => ({ ...prev, query: e.target.value || undefined }))}
          className="w-full rounded-md border border-ink-700 bg-ink-900 px-3 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-500 focus:border-accent-500 focus:outline-none sm:w-56"
        />

        <select
          aria-label="Player count"
          className="field px-2 py-1 pr-7 text-xs"
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
          aria-label="Session length"
          className="field px-2 py-1 pr-7 text-xs"
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
              Unfinished only
            </label>
            <label className="flex items-center gap-1.5 text-xs text-neutral-300">
              <input
                type="checkbox"
                checked={!!filters.onlyUnplayed}
                onChange={(e) => onChange((prev) => ({ ...prev, onlyUnplayed: e.target.checked || undefined }))}
              />
              Never started
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

        {isFiltered(filters) && (
          <button onClick={() => onChange({ genres: [] })} className="text-xs text-neutral-500 underline hover:text-neutral-300">
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {genres.map((genre) => {
          const active = filters.genres.includes(genre);
          return (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active ? "bg-accent-400 text-ink-950" : "bg-ink-800 text-neutral-300 hover:bg-ink-700"
              }`}
            >
              {genre}
            </button>
          );
        })}
      </div>
    </div>
  );
}
