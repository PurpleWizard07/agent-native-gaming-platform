import { useEffect, useMemo } from "react";
import { GAME_BY_ID } from "../data/games";
import { filterGames, allGenres } from "../lib/filterGames";
import { useSession } from "../state/SessionContext";
import { useView } from "../state/ViewContext";
import { GameCard } from "../components/GameCard";
import { FilterBar } from "../components/FilterBar";

export function Library() {
  const { viewer, library } = useSession();
  const { filters, setFilters, setVisibleGameIds } = useView();

  const ownedGames = useMemo(
    () => library.map((e) => GAME_BY_ID[e.gameId]).filter(Boolean),
    [library]
  );

  const genres = useMemo(() => allGenres(ownedGames), [ownedGames]);

  const filtered = useMemo(
    () => filterGames(ownedGames, filters, library),
    [ownedGames, filters, library]
  );

  useEffect(() => {
    setVisibleGameIds(filtered.map((g) => g.id));
  }, [filtered, setVisibleGameIds]);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-neutral-100">Library</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {viewer.name} &middot; {ownedGames.length} games
        </p>
      </section>

      <section>
        <FilterBar
          genres={genres}
          filters={filters}
          onChange={setFilters}
          libraryToggles
        />
      </section>

      <section>
        {filtered.length === 0 ? (
          <p className="text-sm text-neutral-500">No games match these filters.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {filtered.map((g) => (
              <GameCard key={g.id} game={g} owned={true} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
