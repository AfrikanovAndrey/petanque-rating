import React from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { Link } from "react-router-dom";
import {
  TrophyIcon,
  UsersIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowUpIcon,
  CogIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import toast from "react-hot-toast";
import { ratingApi, adminApi } from "../../services/api";
import { formatNumber, handleApiError } from "../../utils";

const AdminDashboard: React.FC = () => {
  const queryClient = useQueryClient();

  // Загружаем данные для статистики
  const { data: ratingData } = useQuery("dashboardRating", async () => {
    const response = await ratingApi.getFullRating();
    return response.data.data || [];
  });

  const { data: tournamentsData } = useQuery(
    "dashboardTournaments",
    async () => {
      const response = await adminApi.getTournaments();
      return response.data.data || [];
    }
  );

  const { data: playersData } = useQuery("dashboardPlayers", async () => {
    const response = await adminApi.getPlayers();
    return response.data.data || [];
  });

  // Мутация для удаления всех команд
  const deleteAllTeamsMutation = useMutation(
    async () => {
      return await adminApi.deleteAllTeams();
    },
    {
      onSuccess: (response) => {
        const deletedCount = response.data.data?.deleted_count || 0;
        toast.success(`Удалено команд: ${deletedCount}`);
        // Обновляем кеш данных
        queryClient.invalidateQueries("dashboardRating");
        queryClient.invalidateQueries("dashboardTournaments");
        queryClient.invalidateQueries("dashboardPlayers");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  // Обработчик удаления всех команд
  const handleDeleteAllTeams = () => {
    if (
      window.confirm(
        "Вы уверены, что хотите удалить ВСЕ команды? Это действие нельзя отменить!"
      )
    ) {
      deleteAllTeamsMutation.mutate();
    }
  };

  // Вычисляем статистику
  const stats = {
    totalPlayers: playersData?.length || 0,
    totalTournaments: tournamentsData?.length || 0,
    totalRatedPlayers:
      ratingData?.filter((p) => p.total_points > 0).length || 0,
    averageRating: ratingData?.length
      ? Math.round(
          ratingData.reduce((sum, p) => sum + p.total_points, 0) /
            ratingData.length
        )
      : 0,
    topPlayer: ratingData?.[0],
    recentTournaments: tournamentsData?.slice(0, 5) || [],
  };

  const statCards = [
    {
      name: "Всего игроков",
      value: formatNumber(stats.totalPlayers),
      icon: UsersIcon,
      color: "bg-blue-500",
      href: "/admin/players",
    },
    {
      name: "Всего турниров",
      value: formatNumber(stats.totalTournaments),
      icon: TrophyIcon,
      color: "bg-green-500",
      href: "/admin/tournaments",
    },
    {
      name: "Игроков с рейтингом",
      value: formatNumber(stats.totalRatedPlayers),
      icon: ChartBarIcon,
      color: "bg-purple-500",
    },
    {
      name: "Средний рейтинг",
      value: formatNumber(stats.averageRating),
      icon: ArrowUpIcon,
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Панель управления</h1>
        <p className="mt-1 text-gray-600">Обзор системы рейтинга игроков</p>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;

          const CardContent = (
            <div className="card p-6 hover:shadow-lg transition-shadow duration-200">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    {stat.name}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {stat.value}
                  </p>
                </div>
              </div>
            </div>
          );

          return stat.href ? (
            <Link key={stat.name} to={stat.href}>
              {CardContent}
            </Link>
          ) : (
            <div key={stat.name}>{CardContent}</div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Топ игроков */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Топ игроков</h2>
            <Link
              to="/"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Посмотреть все
            </Link>
          </div>

          {ratingData && ratingData.length > 0 ? (
            <div className="space-y-4">
              {ratingData.slice(0, 5).map((player, index) => (
                <div
                  key={player.player_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <span
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        index === 0
                          ? "bg-yellow-100 text-yellow-800"
                          : index === 1
                          ? "bg-gray-100 text-gray-800"
                          : index === 2
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="ml-3 font-medium text-gray-900">
                      {player.player_name}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-900">
                    {formatNumber(player.total_points)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">Нет данных для отображения</p>
          )}
        </div>

        {/* Последние турниры */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Последние турниры
            </h2>
            <Link
              to="/admin/tournaments"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Посмотреть все
            </Link>
          </div>

          {stats.recentTournaments.length > 0 ? (
            <div className="space-y-4">
              {stats.recentTournaments.map((tournament) => (
                <div
                  key={tournament.id}
                  className="flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {tournament.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(tournament.date).toLocaleDateString("ru-RU")}
                    </p>
                  </div>
                  <Link
                    to={`/admin/tournaments`}
                    className="text-primary-600 hover:text-primary-700 text-sm"
                  >
                    Подробнее
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">Нет турниров</p>
          )}
        </div>
      </div>

      {/* Быстрые действия */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Быстрые действия
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/admin/tournaments"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
          >
            <PlusIcon className="h-5 w-5 text-gray-400 mr-3" />
            <span className="text-gray-600 font-medium">Загрузить турнир</span>
          </Link>

          <Link
            to="/admin/settings"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
          >
            <CogIcon className="h-5 w-5 text-gray-400 mr-3" />
            <span className="text-gray-600 font-medium">Настроить рейтинг</span>
          </Link>

          <Link
            to="/admin/players"
            className="flex items-center p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors duration-200"
          >
            <UsersIcon className="h-5 w-5 text-gray-400 mr-3" />
            <span className="text-gray-600 font-medium">
              Управление игроками
            </span>
          </Link>

          <button
            onClick={handleDeleteAllTeams}
            disabled={deleteAllTeamsMutation.isLoading}
            className="flex items-center p-4 border-2 border-dashed border-red-300 rounded-lg hover:border-red-400 hover:bg-red-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <TrashIcon className="h-5 w-5 text-red-500 mr-3" />
            <span className="text-red-600 font-medium">
              {deleteAllTeamsMutation.isLoading
                ? "Удаление..."
                : "Удалить все команды"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
