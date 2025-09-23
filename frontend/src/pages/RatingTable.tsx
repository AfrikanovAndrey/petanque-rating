import React, { useState } from "react";
import { useQuery } from "react-query";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { ratingApi } from "../services/api";
import { PlayerRating } from "../types";
import { formatDate, formatNumber, handleApiError } from "../utils";

const RatingTable: React.FC = () => {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<number>>(
    new Set()
  );

  const {
    data: ratingData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    "fullRating",
    async () => {
      const response = await ratingApi.getFullRating();
      return response.data.data || [];
    },
    {
      refetchInterval: 5 * 60 * 1000, // Обновляем каждые 5 минут
    }
  );

  const togglePlayer = (playerId: number) => {
    const newExpandedPlayers = new Set(expandedPlayers);
    if (expandedPlayers.has(playerId)) {
      newExpandedPlayers.delete(playerId);
    } else {
      newExpandedPlayers.add(playerId);
    }
    setExpandedPlayers(newExpandedPlayers);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-600">Загрузка рейтинга...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">
          <p className="text-lg font-medium">Ошибка загрузки рейтинга</p>
          <p className="text-sm">{handleApiError(error)}</p>
        </div>
        <button onClick={() => refetch()} className="btn-primary">
          Попробовать снова
        </button>
      </div>
    );
  }

  if (!ratingData || ratingData.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg text-gray-600">Нет данных для отображения</p>
        <p className="text-sm text-gray-500 mt-2">
          Рейтинг будет доступен после загрузки результатов турниров
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Рейтинг игроков
        </h1>
        <p className="text-gray-600">
          Общий рейтинг основан на {ratingData[0]?.best_results?.length || 8}{" "}
          лучших результатах
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Последнее обновление: {new Date().toLocaleString("ru-RU")}
        </p>
      </div>

      {/* Таблица рейтинга */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  №
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ФИО
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Рейтинг
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Турниры
                </th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ratingData.map((player: PlayerRating, index: number) => {
                const isExpanded = expandedPlayers.has(player.player_id);
                const rank = index + 1;

                return (
                  <React.Fragment key={player.player_id}>
                    {/* Основная строка игрока */}
                    <tr
                      className={`table-row cursor-pointer ${
                        isExpanded ? "expanded" : ""
                      }`}
                      onClick={() => togglePlayer(player.player_id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center">
                          <span className="w-8 text-center">
                            {rank <= 3 && (
                              <span
                                className={`inline-block w-6 h-6 rounded-full text-white text-xs leading-6 ${
                                  rank === 1
                                    ? "bg-yellow-500"
                                    : rank === 2
                                    ? "bg-gray-400"
                                    : "bg-amber-600"
                                }`}
                              >
                                {rank}
                              </span>
                            )}
                            {rank > 3 && <span>{rank}</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {player.player_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="font-semibold text-lg">
                          {formatNumber(player.total_points)}
                        </span>
                        <span className="text-gray-500 ml-1">очков</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {player.all_results.length} турниров
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {isExpanded ? (
                          <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                        )}
                      </td>
                    </tr>

                    {/* Расширенная информация */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 bg-gray-50">
                          <div className="space-y-4">
                            <h4 className="font-medium text-gray-900">
                              Результаты турниров
                            </h4>

                            {player.all_results.length > 0 ? (
                              <div className="grid gap-2">
                                {player.all_results
                                  .sort((a, b) => b.points - a.points)
                                  .map((result, _) => (
                                    <div
                                      key={`${result.tournament_id}-${result.player_id}`}
                                      className={`flex justify-between items-center p-3 rounded-lg ${
                                        result.is_counted
                                          ? "bg-primary-50 border border-primary-200"
                                          : "bg-white border border-gray-200"
                                      }`}
                                    >
                                      <div className="flex-1">
                                        <div className="font-medium text-gray-900">
                                          {result.tournament_name}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                          {formatDate(
                                            result.tournament_date || ""
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center space-x-3">
                                        <div className="text-sm text-gray-600">
                                          {result.position} место
                                        </div>
                                        <div
                                          className={`font-semibold ${
                                            result.is_counted
                                              ? "text-primary-600"
                                              : "text-gray-900"
                                          }`}
                                        >
                                          {result.points} очков
                                        </div>
                                        {result.is_counted && (
                                          <div className="badge badge-primary">
                                            Засчитано
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <p className="text-gray-500 italic">
                                Нет результатов турниров
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Информация о системе рейтинга */}
      <div className="card p-6">
        <h3 className="font-semibold text-gray-900 mb-3">О системе рейтинга</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            • Рейтинг рассчитывается на основе лучших результатов игрока в
            турнирах
          </p>
          <p>
            • Для подсчета общего рейтинга используются{" "}
            {ratingData[0]?.best_results?.length || 8} лучших результата
          </p>
          <p>• Очки начисляются в зависимости от занятого места в турнире</p>
          <p>
            • Результаты, входящие в топ-
            {ratingData[0]?.best_results?.length || 8}, выделены цветом
          </p>
        </div>
      </div>
    </div>
  );
};

export default RatingTable;
