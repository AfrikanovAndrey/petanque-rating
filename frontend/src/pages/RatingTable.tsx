import React, { useState, useMemo } from "react";
import { useQuery } from "react-query";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { ratingApi } from "../services/api";
import { PlayerRating, getPointsReasonText } from "../types";
import { formatDate, formatNumber, handleApiError } from "../utils";

type RatingViewType = "male" | "female";

const RatingTable: React.FC = () => {
  const [expandedPlayers, setExpandedPlayers] = useState<Set<number | null>>(
    new Set()
  );
  const [ratingView, setRatingView] = useState<RatingViewType>("male");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const {
    data: ratingData,
    isLoading,
    error,
    refetch,
  } = useQuery(
    ["rating", ratingView],
    async () => {
      const response = await ratingApi.getRatingsByGender();
      switch (ratingView) {
        case "male":
          return response.data.data.male || [];
        case "female":
          return response.data.data.female || [];
        default:
          return response.data.data.male || [];
      }
    },
    {
      refetchInterval: 5 * 60 * 1000, // Обновляем каждые 5 минут
    }
  );

  // Фильтрация данных по поисковому запросу
  const filteredRatingData = useMemo(() => {
    if (!ratingData || !searchTerm.trim()) {
      return ratingData || [];
    }

    const searchLower = searchTerm.toLowerCase().trim();
    return ratingData.filter((player: PlayerRating) => {
      const displayName = player.licensed_name || player.player_name || "";
      return displayName.toLowerCase().includes(searchLower);
    });
  }, [ratingData, searchTerm]);

  const clearSearch = () => {
    setSearchTerm("");
  };

  const togglePlayer = (playerId: number | null) => {
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
          Рейтинг будет доступен после загрузки лицензированных игроков и
          результатов турниров
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Только лицензированные игроки получают очки и участвуют в рейтинге
        </p>
      </div>
    );
  }

  const getRatingTitle = () => {
    switch (ratingView) {
      case "male":
        return "Мужской рейтинг";
      case "female":
        return "Женский рейтинг";
      default:
        return "Мужской рейтинг";
    }
  };

  return (
    <div className="space-y-6">
      {/* Заголовок и переключатель */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          {getRatingTitle()}
        </h1>

        {/* Переключатель типа рейтинга */}
        <div className="flex justify-center mb-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setRatingView("male")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                ratingView === "male"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Мужской рейтинг
            </button>
            <button
              onClick={() => setRatingView("female")}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                ratingView === "female"
                  ? "bg-white text-pink-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Женский рейтинг
            </button>
          </div>
        </div>

        <p className="text-gray-600">
          Рейтинг основан на {ratingData?.[0]?.best_results?.length || 8} лучших
          результатах
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Последнее обновление: {new Date().toLocaleString("ru-RU")}
        </p>

        {/* Поле поиска */}
        <div className="flex justify-center mt-6">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Поиск игрока по имени..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={clearSearch}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Результаты поиска */}
        {searchTerm.trim() && (
          <div className="text-center mt-2">
            <p className="text-sm text-gray-600">
              {filteredRatingData.length > 0
                ? `Найдено игроков: ${filteredRatingData.length}`
                : "Игроки не найдены"}
            </p>
          </div>
        )}
      </div>

      {/* Таблица рейтинга */}
      <div className="card overflow-hidden">
        {/* Сообщение когда нет результатов поиска */}
        {searchTerm.trim() && filteredRatingData.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-lg text-gray-600">
              По запросу "{searchTerm}" ничего не найдено
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Попробуйте изменить поисковый запрос или{" "}
              <button
                onClick={clearSearch}
                className="text-blue-600 hover:text-blue-700 underline"
              >
                очистить поиск
              </button>
            </p>
          </div>
        ) : (
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
                {filteredRatingData.map(
                  (player: PlayerRating, index: number) => {
                    const isExpanded = expandedPlayers.has(player.player_id);
                    const rank = index + 1;
                    // Используем licensed_name или player_name как ключ, если player_id null
                    const playerKey =
                      player.player_id ||
                      `licensed_${player.licensed_name || player.player_name}`;

                    return (
                      <React.Fragment key={playerKey}>
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
                            <span>
                              {player.licensed_name || player.player_name}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="font-semibold text-lg">
                              {formatNumber(player.total_points)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {player.all_results.length}
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
                                          key={`${result.tournament_id}-${result.team_id}`}
                                          className={`flex justify-between items-center p-3 rounded-lg ${
                                            result.is_counted
                                              ? "bg-primary-50 border border-primary-200"
                                              : "bg-white border border-gray-200"
                                          }`}
                                        >
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2 font-medium text-gray-900">
                                              <span
                                                className={`${
                                                  result.is_counted
                                                    ? "text-primary-600"
                                                    : "text-gray-900"
                                                }`}
                                              >
                                                {result.points}
                                              </span>
                                              <span>-</span>
                                              <span>
                                                {result.tournament_name}
                                              </span>
                                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                                {getPointsReasonText(
                                                  result.points_reason ||
                                                    result.cup_position ||
                                                    "",
                                                  result.cup
                                                )}
                                              </span>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                              {formatDate(
                                                result.tournament_date || ""
                                              )}
                                            </div>
                                          </div>
                                          <div className="flex items-center">
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
                  }
                )}
              </tbody>
            </table>
          </div>
        )}
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
            {ratingData?.[0]?.best_results?.length || 8} лучших результата
          </p>
          <p>• Очки начисляются в зависимости от занятого места в турнире</p>
          <p>
            • Результаты, входящие в топ-
            {ratingData?.[0]?.best_results?.length || 8}, выделены цветом
          </p>
          <p>• В рейтинге участвуют только лицензированные игроки</p>
          <p>• Игроки турниров сопоставляются с лицензированными по фамилии</p>
          <p>
            • Показано соответствие: имя в турнире → полное лицензированное имя
          </p>
        </div>
      </div>
    </div>
  );
};

export default RatingTable;
