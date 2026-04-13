import { ArrowLeftIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import React from "react";
import { useQuery } from "react-query";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "../../services/api";
import { TournamentStatus } from "../../types";
import {
  formatDate,
  formatDateTime,
  getTornamentCategoryText,
  getTournamentStatusText,
  getTournamentTypeIcons,
  getTournamentTypeText,
  handleApiError,
} from "../../utils";

/** Служебные сообщения Vite/сборки не показываем как текст регламента (могли оказаться в БД по ошибке). */
function regulationsForDisplay(raw: string | null | undefined): string {
  const s = raw?.trim();
  if (!s) return "— не указан —";
  if (
    /\[vite\]|Internal server error|Failed to resolve import/i.test(s)
  ) {
    return "— не указан —";
  }
  return s;
}

const AdminTournamentRegistration: React.FC = () => {
  const { tournamentId: tournamentIdParam } = useParams<{
    tournamentId: string;
  }>();
  const tournamentId = parseInt(tournamentIdParam || "", 10);

  const { data, isLoading, error } = useQuery(
    ["tournamentRegistration", tournamentId],
    async () => {
      const response = await adminApi.getTournamentRegistrationPage(
        tournamentId
      );
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || "Не удалось загрузить данные");
      }
      return response.data.data;
    },
    {
      enabled: Number.isFinite(tournamentId) && tournamentId > 0,
      retry: false,
    }
  );

  if (!Number.isFinite(tournamentId) || tournamentId <= 0) {
    return (
      <div className="space-y-4">
        <p className="text-red-600">Некорректный идентификатор турнира.</p>
        <Link to="/admin/tournaments" className="text-primary-600 hover:underline">
          ← К списку турниров
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-center">
          <div className="loading-spinner mb-4 mx-auto" />
          <p className="text-gray-600">Загрузка…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          {handleApiError(error)}
        </div>
        <Link
          to="/admin/tournaments"
          className="inline-flex items-center text-primary-600 hover:underline"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          К списку турниров
        </Link>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { tournament, teams } = data;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/tournaments"
          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-800 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          К списку турниров
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardDocumentListIcon className="h-9 w-9 text-primary-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Регистрация на турнир
            </h1>
            <p className="mt-1 text-gray-600">{tournament.name}</p>
          </div>
        </div>
      </div>

      <div className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Сведения о турнире
        </h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">
              Название
            </dt>
            <dd className="mt-1 text-gray-900">{tournament.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">
              Дата проведения
            </dt>
            <dd className="mt-1 text-gray-900">{formatDate(tournament.date)}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">
              Тип турнира
            </dt>
            <dd className="mt-1 flex items-center gap-2 text-gray-900">
              {getTournamentTypeText(tournament.type) ?? tournament.type}
              {getTournamentTypeIcons(tournament.type)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">
              Категория
            </dt>
            <dd className="mt-1 text-gray-900">
              {getTornamentCategoryText(tournament.category)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">
              Статус
            </dt>
            <dd className="mt-1 text-gray-900">
              {getTournamentStatusText(
                tournament.status ?? TournamentStatus.REGISTRATION
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">
              Режим загрузки
            </dt>
            <dd className="mt-1 text-gray-900">
              {tournament.manual ? "Ручной" : "Автоматический"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase text-gray-500">
              Регламент
            </dt>
            <dd className="mt-1 text-gray-900 whitespace-pre-wrap">
              {regulationsForDisplay(tournament.regulations)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Зарегистрированные команды
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Всего: {teams.length}
          </p>
        </div>
        {teams.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Пока нет зарегистрированных команд.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    №
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Состав команды
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Дата записи
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {teams.map((team, index) => (
                  <tr key={team.team_id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {team.players.join(", ")}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDateTime(team.registered_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTournamentRegistration;
