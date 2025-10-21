import {
  ChevronDownIcon,
  ChevronRightIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import React, { useMemo, useState } from "react";
import { useQuery } from "react-query";
import { adminApi, ratingApi } from "../services/api";
import { PlayerRating, getCupPositionText } from "../types";
import { formatDate, formatNumber, handleApiError } from "../utils";
import { getTournamentTypeIcons } from "../utils/tournamentIcons";

type RatingViewType = "male" | "female";

// Компонент всплывающей подсказки
const Tooltip: React.FC<{ children: React.ReactNode; text: string }> = ({
  children,
  text,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {isVisible && (
        <div className="absolute z-10 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg top-full left-1/2 transform -translate-x-1/2 mt-2 whitespace-nowrap normal-case">
          {text}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
        </div>
      )}
    </div>
  );
};

// Функция для расчета win rate
const calculateWinRate = (
  results: { wins?: number; loses?: number; tournament_manual?: boolean }[]
): number => {
  // Фильтруем только турниры без manual режима
  const nonManualResults = results.filter(
    (result) => !result.tournament_manual
  );

  const totalWins = nonManualResults.reduce(
    (sum, result) => sum + (result.wins || 0),
    0
  );
  const totalLoses = nonManualResults.reduce(
    (sum, result) => sum + (result.loses || 0),
    0
  );

  if (totalWins === 0 && totalLoses === 0) {
    return 0;
  }

  return (totalWins / (totalWins + totalLoses)) * 100;
};

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
  } = useQuery<PlayerRating[]>(
    ["rating", ratingView],
    async () => {
      const response = await ratingApi.getRatingsByGender(ratingView);
      return response.data?.data || [];
    },
    {
      refetchInterval: 5 * 60 * 1000, // Обновляем каждые 5 минут
    }
  );

  // Получаем настройку количества лучших результатов
  const { data: settingsData } = useQuery<{ best_results_count: number }>(
    "bestResultsCount",
    async () => {
      const response = await adminApi.getBestResultsCount();
      return response.data?.data || { best_results_count: 8 };
    },
    {
      refetchInterval: 5 * 60 * 1000, // Обновляем каждые 5 минут
    }
  );

  const bestResultsCount = settingsData?.best_results_count || 8;

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
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 px-2">
          {getRatingTitle()}
        </h1>

        {/* Переключатель типа рейтинга */}
        <div className="flex justify-center mb-4 px-2">
          <div className="flex bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
            <button
              onClick={() => setRatingView("male")}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                ratingView === "male"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Мужской рейтинг
            </button>
            <button
              onClick={() => setRatingView("female")}
              className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                ratingView === "female"
                  ? "bg-white text-pink-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Женский рейтинг
            </button>
          </div>
        </div>

        <p className="text-sm sm:text-base text-gray-600 px-2">
          Рейтинг основан на {bestResultsCount} лучших результатах (
          {ratingData?.length || 0} игроков)
        </p>
        <p className="text-xs sm:text-sm text-gray-500 mt-1 px-2">
          Последнее обновление: {new Date().toLocaleString("ru-RU")}
        </p>

        {/* Поле поиска */}
        <div className="flex justify-center mt-6 px-2">
          <div className="relative max-w-md w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
          <div className="text-center mt-2 px-2">
            <p className="text-xs sm:text-sm text-gray-600">
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
            <p className="text-base sm:text-lg text-gray-600">
              По запросу "{searchTerm}" ничего не найдено
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-2">
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
          <>
            {/* Таблица для десктопа */}
            <div className="hidden md:block overflow-x-auto">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        Win Rate
                        <Tooltip text="Отношение выигранных матчей к общему количеству">
                          <InformationCircleIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </Tooltip>
                      </div>
                    </th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRatingData.map(
                    (player: PlayerRating, index: number) => {
                      const isExpanded = expandedPlayers.has(player.player_id);
                      const rank = index + 1;
                      const playerKey =
                        player.player_id ||
                        `licensed_${
                          player.licensed_name || player.player_name
                        }`;

                      return (
                        <React.Fragment key={playerKey}>
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {(() => {
                                const nonManualResults =
                                  player.all_results.filter(
                                    (result) => !result.tournament_manual
                                  );
                                const totalWins = nonManualResults.reduce(
                                  (sum, r) => sum + (r.wins || 0),
                                  0
                                );
                                const totalGames = nonManualResults.reduce(
                                  (sum, r) =>
                                    sum + (r.wins || 0) + (r.loses || 0),
                                  0
                                );

                                if (totalGames === 0) {
                                  return (
                                    <span className="text-gray-400">—</span>
                                  );
                                }

                                return (
                                  <>
                                    <span className="font-medium">
                                      {calculateWinRate(
                                        player.all_results
                                      ).toFixed(1)}
                                      %
                                    </span>
                                    <span className="text-gray-500 ml-1">
                                      ({totalWins}/{totalGames})
                                    </span>
                                  </>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              {isExpanded ? (
                                <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                              )}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={6} className="px-6 py-4 bg-gray-50">
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
                                                <span className="flex items-center">
                                                  {result.tournament_name}
                                                  {result.tournament_type &&
                                                    getTournamentTypeIcons(
                                                      result.tournament_type
                                                    )}
                                                </span>
                                                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                                  {getCupPositionText(
                                                    result.cup_position || "",
                                                    result.cup
                                                  ) || "Квалификация"}
                                                </span>
                                              </div>
                                              <div className="text-sm text-gray-500">
                                                {formatDate(
                                                  result.tournament_date || ""
                                                )}
                                              </div>
                                              <div className="text-sm text-gray-500">
                                                Команда: {result.team_players}
                                              </div>
                                              {!result.tournament_manual && (
                                                <div className="text-sm text-gray-500 mt-1">
                                                  Win Rate:{" "}
                                                  {(result.wins || 0) +
                                                    (result.loses || 0) >
                                                  0
                                                    ? (
                                                        ((result.wins || 0) /
                                                          ((result.wins || 0) +
                                                            (result.loses ||
                                                              0))) *
                                                        100
                                                      ).toFixed(1)
                                                    : "0.0"}
                                                  %
                                                  <span className="text-gray-500 ml-1">
                                                    ({result.wins || 0}/
                                                    {(result.wins || 0) +
                                                      (result.loses || 0)}
                                                    )
                                                  </span>
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

            {/* Карточки для мобильных */}
            <div className="md:hidden divide-y divide-gray-200">
              {filteredRatingData.map((player: PlayerRating, index: number) => {
                const isExpanded = expandedPlayers.has(player.player_id);
                const rank = index + 1;
                const playerKey =
                  player.player_id ||
                  `licensed_${player.licensed_name || player.player_name}`;
                const winRate = calculateWinRate(player.all_results);
                // Фильтруем только турниры без manual режима для подсчета статистики
                const nonManualResults = player.all_results.filter(
                  (result) => !result.tournament_manual
                );
                const totalWins = nonManualResults.reduce(
                  (sum, r) => sum + (r.wins || 0),
                  0
                );
                const totalGames = nonManualResults.reduce(
                  (sum, r) => sum + (r.wins || 0) + (r.loses || 0),
                  0
                );

                return (
                  <div key={playerKey} className="bg-white">
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => togglePlayer(player.player_id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="flex-shrink-0">
                            {rank <= 3 ? (
                              <span
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold ${
                                  rank === 1
                                    ? "bg-yellow-500"
                                    : rank === 2
                                    ? "bg-gray-400"
                                    : "bg-amber-600"
                                }`}
                              >
                                {rank}
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-center w-8 h-8 text-gray-900 text-sm font-bold">
                                {rank}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold text-gray-900 break-words">
                              {player.licensed_name || player.player_name}
                            </h3>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                              <span>Турниры: {player.all_results.length}</span>
                              {totalGames > 0 && (
                                <>
                                  <span>•</span>
                                  <span>
                                    Win Rate: {winRate.toFixed(1)}% ({totalWins}
                                    /{totalGames})
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              {formatNumber(player.total_points)}
                            </div>
                            <div className="text-xs text-gray-500">очков</div>
                          </div>
                          {isExpanded ? (
                            <ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          ) : (
                            <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 bg-gray-50">
                        <h4 className="font-medium text-gray-900 mb-3 text-sm">
                          Результаты турниров
                        </h4>
                        {player.all_results.length > 0 ? (
                          <div className="space-y-2">
                            {player.all_results
                              .sort((a, b) => b.points - a.points)
                              .map((result, _) => (
                                <div
                                  key={`${result.tournament_id}-${result.team_id}`}
                                  className={`p-3 rounded-lg ${
                                    result.is_counted
                                      ? "bg-primary-50 border border-primary-200"
                                      : "bg-white border border-gray-200"
                                  }`}
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span
                                          className={`text-base font-bold ${
                                            result.is_counted
                                              ? "text-primary-600"
                                              : "text-gray-900"
                                          }`}
                                        >
                                          {result.points}
                                        </span>
                                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                                          {getCupPositionText(
                                            result.cup_position || "",
                                            result.cup
                                          ) || "Квалификация"}
                                        </span>
                                      </div>
                                      <div className="text-sm font-medium text-gray-900 flex items-center gap-1 flex-wrap">
                                        <span>{result.tournament_name}</span>
                                        {result.tournament_type &&
                                          getTournamentTypeIcons(
                                            result.tournament_type
                                          )}
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">
                                        {formatDate(
                                          result.tournament_date || ""
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="space-y-1 text-xs text-gray-600">
                                    <div className="flex items-center gap-2 flex-wrap"></div>
                                    <div>Команда: {result.team_players}</div>
                                    {!result.tournament_manual && (
                                      <div>
                                        Win Rate:{" "}
                                        {(result.wins || 0) +
                                          (result.loses || 0) >
                                        0
                                          ? (
                                              ((result.wins || 0) /
                                                ((result.wins || 0) +
                                                  (result.loses || 0))) *
                                              100
                                            ).toFixed(1)
                                          : "0.0"}
                                        % ({result.wins || 0}/
                                        {(result.wins || 0) +
                                          (result.loses || 0)}
                                        )
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic text-sm">
                            Нет результатов турниров
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Информация о системе рейтинга */}
      <div className="card p-4 sm:p-6">
        <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">
          О системе рейтинга
        </h3>
        <div className="text-xs sm:text-sm text-gray-600 space-y-1.5 sm:space-y-2">
          <p>
            • Рейтинг рассчитывается на основе лучших результатов игрока в
            турнирах
          </p>
          <p>
            • Для подсчета общего рейтинга используются {bestResultsCount}{" "}
            лучших результата
          </p>
          <p>• Очки начисляются в зависимости от занятого места в турнире</p>
          <p>
            • Результаты, входящие в топ-
            {bestResultsCount}, выделены цветом
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
