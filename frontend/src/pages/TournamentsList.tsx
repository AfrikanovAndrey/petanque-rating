import {
  CalendarIcon,
  TrophyIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import { Link } from "react-router-dom";
import TournamentListFiltersPanel from "../components/TournamentListFiltersPanel";
import { tournamentsApi } from "../services/api";
import { TournamentStatus } from "../types";
import {
  applyTournamentListFilters,
  buildYearTabs,
  cn,
  EMPTY_TOURNAMENT_LIST_FILTERS,
  filterTournamentsByYear,
  formatDate,
  getTornamentCategoryText,
  getTournamentStatusText,
  getTournamentTypeIcons,
  loadTournamentFiltersFromCookie,
  saveTournamentFiltersToCookie,
  type TournamentListFilters,
} from "../utils";
import {
  canUsePreferenceCookies,
  COOKIE_CONSENT_RESET_EVENT,
} from "../utils/cookieConsent";

const TournamentsList: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [filters, setFilters] = useState<TournamentListFilters>(() =>
    loadTournamentFiltersFromCookie()
  );

  const {
    data: tournaments,
    isLoading,
    error,
  } = useQuery("tournaments", async () => {
    const response = await tournamentsApi.getAllTournaments();
    return response.data.data || [];
  });

  const yearTabs = useMemo(
    () => (tournaments?.length ? buildYearTabs(tournaments, currentYear) : []),
    [tournaments, currentYear]
  );

  useEffect(() => {
    if (yearTabs.length === 0) {
      return;
    }
    setSelectedYear((prev) =>
      prev !== null && yearTabs.includes(prev) ? prev : yearTabs[0]
    );
  }, [yearTabs]);

  useEffect(() => {
    const resetFiltersOnConsentChange = () => {
      setFilters({ ...EMPTY_TOURNAMENT_LIST_FILTERS });
    };
    window.addEventListener(
      COOKIE_CONSENT_RESET_EVENT,
      resetFiltersOnConsentChange
    );
    return () => {
      window.removeEventListener(
        COOKIE_CONSENT_RESET_EVENT,
        resetFiltersOnConsentChange
      );
    };
  }, []);

  useEffect(() => {
    if (!canUsePreferenceCookies()) {
      return;
    }
    saveTournamentFiltersToCookie(filters);
  }, [filters]);

  const yearTournaments = useMemo(() => {
    if (!tournaments || selectedYear === null) {
      return [];
    }
    return filterTournamentsByYear(tournaments, selectedYear);
  }, [tournaments, selectedYear]);

  const displayedTournaments = useMemo(
    () => applyTournamentListFilters(yearTournaments, filters),
    [yearTournaments, filters]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка турниров...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Ошибка загрузки
        </h3>
        <p className="text-gray-500">Не удалось загрузить список турниров</p>
      </div>
    );
  }

  const publicSnapshotPath = (tournament: {
    id: number;
    status?: TournamentStatus | null;
  }) => {
    if (tournament.status === TournamentStatus.REGISTRATION) {
      return `/tournaments/${tournament.id}/registration`;
    }
    if (tournament.status === TournamentStatus.FINISHED) {
      return `/tournaments/${tournament.id}/finished`;
    }
    return `/tournaments/${tournament.id}/in-progress`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center px-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Турниры
        </h1>
      </div>

      {yearTabs.length > 0 && selectedYear !== null && (
        <div
          className="flex flex-wrap justify-center gap-2"
          role="tablist"
          aria-label="Турниры по годам"
        >
          {yearTabs.map((year) => (
            <button
              key={year}
              type="button"
              role="tab"
              aria-selected={selectedYear === year}
              onClick={() => setSelectedYear(year)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                selectedYear === year
                  ? "bg-primary-600 text-white shadow"
                  : "bg-white text-gray-700 shadow hover:bg-gray-50"
              )}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {tournaments && tournaments.length > 0 && (
        <div className="flex justify-center">
          <TournamentListFiltersPanel filters={filters} onChange={setFilters} />
        </div>
      )}

      {tournaments && tournaments.length > 0 ? (
        yearTournaments.length > 0 ? (
          displayedTournaments.length > 0 ? (
            <div className="space-y-4">
              {displayedTournaments.map((tournament) => {
                const navigatesToPublicSnapshot =
                  tournament.status === TournamentStatus.REGISTRATION ||
                  tournament.status === TournamentStatus.FINAL_REGISTRATION ||
                  tournament.status === TournamentStatus.IN_PROGRESS ||
                  tournament.status === TournamentStatus.FINISHED;

                const rowSummary = (
                  <div className="flex items-start sm:items-center justify-between">
                    <div className="flex-1 min-w-0 mr-2">
                      <div className="flex items-center mb-1 flex-wrap gap-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                          {tournament.name}
                        </h3>
                        {getTournamentTypeIcons(tournament.type)}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center text-xs sm:text-sm text-gray-500 gap-1 sm:gap-4">
                        <div className="flex items-center">
                          <CalendarIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          {formatDate(tournament.date)}
                        </div>
                        <div className="flex items-center">
                          {getTornamentCategoryText(tournament.category)}
                        </div>
                        <div className="flex items-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              tournament.status === TournamentStatus.REGISTRATION
                                ? "bg-amber-100 text-amber-900"
                                : tournament.status ===
                                    TournamentStatus.FINAL_REGISTRATION
                                  ? "bg-emerald-100 text-emerald-900"
                                  : tournament.status ===
                                      TournamentStatus.IN_PROGRESS
                                    ? "bg-sky-100 text-sky-900"
                                    : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {getTournamentStatusText(tournament.status)}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <UsersIcon className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                          Команд: {tournament.teams_count ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <div
                    key={tournament.id}
                    className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200"
                  >
                    {navigatesToPublicSnapshot ? (
                      <Link
                        to={publicSnapshotPath(tournament)}
                        className="block p-4 sm:p-6 text-inherit no-underline rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 hover:bg-gray-50/70"
                      >
                        {rowSummary}
                      </Link>
                    ) : (
                      <div className="p-4 sm:p-6">{rowSummary}</div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет турниров
              </h3>
              <p className="text-gray-500 mb-4">
                Нет турниров по выбранным фильтрам
              </p>
              <button
                type="button"
                onClick={() =>
                  setFilters({ statuses: [], types: [], categories: [] })
                }
                className="text-sm font-medium text-primary-600 hover:text-primary-800"
              >
                Сбросить фильтры
              </button>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет турниров
            </h3>
            <p className="text-gray-500">
              За {selectedYear} год турниры пока не проводились
            </p>
          </div>
        )
      ) : (
        <div className="text-center py-12">
          <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Нет турниров
          </h3>
          <p className="text-gray-500">Турниры пока не проводились</p>
        </div>
      )}
    </div>
  );
};

export default TournamentsList;
