import { useEffect, useMemo } from "react";
import { GAMES } from "../data/games";
import { useSession } from "../state/SessionContext";
import { useView } from "../state/ViewContext";
import { filterGames, allGenres } from "../lib/filterGames";
import { FilterBar } from "../components/FilterBar";
import { GameCard } from "../components/GameCard";

const genres = allGenres(GAMES);

export function Store() {
  const { library } = useSession();
  const { filters, setFilters, setVisibleGameIds } = useView();

  const filtered = useMemo(() => filterGames(GAMES, filters, library), [filters, library]);

  useEffect(() => {
    setVisibleGameIds(filtered.map((g) => g.id));
  }, [filtered, setVisibleGameIds]);

  // Cleared on unmount so get_current_view on a page with no game list (Friends,
  // Party) reports an empty screen rather than the list the player left behind.
  useEffect(() => () => setVisibleGameIds([]), [setVisibleGameIds]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold text-neutral-100">Store</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Browse the full catalog and filter to find something to play.
        </p>
      </section>

      <section>
        <FilterBar genres={genres} filters={filters} onChange={setFilters} />
      </section>

      <section>
        <p className="mb-3 text-sm text-neutral-400">{filtered.length} games</p>
        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-500">No games match these filters.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((g) => (
              <GameCard
                key={g.id}
                game={g}
                owned={library.some((e) => e.gameId === g.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
