import React, { useState } from "react";
import { useQuery } from "react-query";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrophyIcon,
  CalendarIcon,
  UserGroupIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { tournamentsApi } from "../services/api";
import { formatDate, handleApiError } from "../utils";
import { TournamentWithResults } from "../types";

const TournamentsList: React.FC = () => {
  const [expandedTournament, setExpandedTournament] = useState<number | null>(
    null
  );
  const [tournamentDetails, setTournamentDetails] = useState<
    Record<number, TournamentWithResults>
  >({});

  // Загружаем список турниров
  const {
    data: tournaments,
    isLoading,
    error,
  } = useQuery("tournaments", async () => {
    const response = await tournamentsApi.getAllTournaments();
    return response.data.data || [];
  });

  // Загружаем детали конкретного турнира
  const loadTournamentDetails = async (tournamentId: number) => {
    if (tournamentDetails[tournamentId]) {
      return; // Уже загружены
    }

    try {
      const response = await tournamentsApi.getTournamentDetails(tournamentId);
      const tournamentData = response.data.data;
      if (tournamentData) {
        setTournamentDetails((prev: Record<number, TournamentWithResults>) => ({
          ...prev,
          [tournamentId]: tournamentData,
        }));
      }
    } catch (error) {
      console.error(
        "Ошибка при загрузке деталей турнира:",
        handleApiError(error)
      );
    }
  };

  const handleToggleExpand = async (tournamentId: number) => {
    if (expandedTournament === tournamentId) {
      // Закрываем
      setExpandedTournament(null);
    } else {
      // Открываем
      setExpandedTournament(tournamentId);
      await loadTournamentDetails(tournamentId);
    }
  };

  const getPositionBadge = (position: number) => {
    if (position === 1) return "🥇";
    if (position === 2) return "🥈";
    if (position === 3) return "🥉";
    return `${position}`;
  };

  const getPositionColor = (position: number) => {
    if (position === 1) return "text-yellow-600";
    if (position === 2) return "text-gray-600";
    if (position === 3) return "text-amber-600";
    return "text-gray-900";
  };

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

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Турниры</h1>
        <p className="text-gray-600">
          История турниров с детальными результатами
        </p>
      </div>

      {/* Статистика */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <TrophyIcon className="h-8 w-8 text-primary-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {tournaments?.length || 0}
            </p>
            <p className="text-sm text-gray-500">Всего турниров</p>
          </div>
          <div className="text-center">
            <CalendarIcon className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {tournaments?.filter(
                (t) =>
                  new Date(t.date).getFullYear() === new Date().getFullYear()
              ).length || 0}
            </p>
            <p className="text-sm text-gray-500">В этом году</p>
          </div>
          <div className="text-center">
            <ChartBarIcon className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-gray-900">
              {tournaments?.reduce((sum, tournament) => {
                const details = tournamentDetails[tournament.id];
                return sum + (details?.results.length || 0);
              }, 0) || "—"}
            </p>
            <p className="text-sm text-gray-500">Участий игроков</p>
          </div>
        </div>
      </div>

      {/* Список турниров */}
      {tournaments && tournaments.length > 0 ? (
        <div className="space-y-4">
          {tournaments
            .sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )
            .map((tournament) => {
              const isExpanded = expandedTournament === tournament.id;
              const details = tournamentDetails[tournament.id];

              return (
                <div
                  key={tournament.id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow duration-200"
                >
                  {/* Заголовок турнира */}
                  <div
                    className="p-6 cursor-pointer"
                    onClick={() => handleToggleExpand(tournament.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {tournament.name}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500 space-x-4">
                          <div className="flex items-center">
                            <CalendarIcon className="h-4 w-4 mr-1" />
                            {formatDate(tournament.date)}
                          </div>
                          {details && (
                            <div className="flex items-center">
                              <UserGroupIcon className="h-4 w-4 mr-1" />
                              {details.results.length} участников
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        {isExpanded ? (
                          <ChevronUpIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Результаты турнира */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 px-6 pb-6">
                      {details ? (
                        <div className="pt-4">
                          <h4 className="text-md font-medium text-gray-900 mb-4">
                            Результаты турнира
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Место
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Игрок
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Очки
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {details.results.map((result, index) => (
                                  <tr
                                    key={result.id}
                                    className={
                                      index < 3
                                        ? "bg-gradient-to-r from-yellow-50 to-transparent"
                                        : ""
                                    }
                                  >
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div
                                        className={`text-sm font-medium ${getPositionColor(
                                          result.position
                                        )}`}
                                      >
                                        {getPositionBadge(result.position)}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="text-sm font-medium text-gray-900">
                                        {result.player_name}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <div className="text-sm text-gray-900 font-medium">
                                        {result.points}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-4 text-center">
                          <div className="animate-spin h-6 w-6 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">
                            Загрузка результатов...
                          </p>
                        </div>
                      )}
                    </div>
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
          <p className="text-gray-500">Турниры пока не проводились</p>
        </div>
      )}
    </div>
  );
};

export default TournamentsList;
