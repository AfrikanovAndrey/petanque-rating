import { ArrowLeftIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { useQuery } from "react-query";
import { Link, useParams } from "react-router-dom";
import { RegisterTeamModal } from "../components/RegisterTeamModal";
import { getPublicTournamentRegistration } from "../services/api";
import { TournamentStatus } from "../types";
import {
  formatDate,
  formatDateTime,
  getTornamentCategoryText,
  getTournamentStatusText,
  getTournamentTypeIcons,
  getTournamentTypeText,
  handleApiError,
  regulationsForDisplay,
} from "../utils";

const TournamentRegistrationPublic: React.FC = () => {
  const { tournamentId: tournamentIdParam } = useParams<{
    tournamentId: string;
  }>();
  const tournamentId = parseInt(tournamentIdParam || "", 10);
  const [registerOpen, setRegisterOpen] = useState(false);

  const { data, isLoading, error } = useQuery(
    ["publicTournamentRegistration", tournamentId],
    async () => {
      const response = await getPublicTournamentRegistration(tournamentId);
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
        <Link to="/tournaments" className="text-primary-600 hover:underline">
          ← К списку турниров
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[320px]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
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
          to="/tournaments"
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
          to="/tournaments"
          className="inline-flex items-center text-sm text-primary-600 hover:text-primary-800 mb-4"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          К списку турниров
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardDocumentListIcon className="h-9 w-9 text-primary-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Регистрация на турнир
            </h1>
            <p className="mt-1 text-gray-600">{tournament.name}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6 space-y-6">
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 px-4 sm:px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Зарегистрированные команды
            </h2>
            <p className="mt-1 text-sm text-gray-500">Всего: {teams.length}</p>
          </div>
          {/* Страница с данными с сервера доступна только в фазе регистрации */}
          <button
            type="button"
            onClick={() => setRegisterOpen(true)}
            className="inline-flex justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Зарегистрировать команду
          </button>
        </div>
        {teams.length === 0 ? (
          <div className="px-4 sm:px-6 py-12 text-center text-gray-500">
            Пока нет зарегистрированных команд.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    №
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Состав команды
                  </th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Дата записи
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {teams.map((team, index) => (
                  <tr key={team.team_id}>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-900">
                      {team.players.join(", ")}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {formatDateTime(team.registered_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {registerOpen && (
        <RegisterTeamModal
          tournamentId={tournamentId}
          tournament={tournament}
          onClose={() => setRegisterOpen(false)}
        />
      )}
    </div>
  );
};

export default TournamentRegistrationPublic;
