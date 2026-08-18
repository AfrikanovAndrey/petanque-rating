import { ArrowLeftIcon, BuildingLibraryIcon } from "@heroicons/react/24/outline";
import React from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "react-query";
import { clubsApi } from "../services/api";
import { formatDate, handleApiError } from "../utils";

const ClubDetail: React.FC = () => {
  const { clubId } = useParams<{ clubId: string }>();
  const id = parseInt(clubId || "", 10);

  const {
    data: club,
    isLoading,
    error,
  } = useQuery(
    ["public-club", id],
    async () => {
      const response = await clubsApi.getClub(id);
      return response.data.data;
    },
    { enabled: !Number.isNaN(id), staleTime: 5 * 60 * 1000 }
  );

  if (Number.isNaN(id)) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Неверный идентификатор клуба
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error ? handleApiError(error) : "Клуб не найден"}
        </div>
        <Link to="/clubs" className="text-primary-600 hover:underline">
          ← К списку клубов
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      <Link
        to="/clubs"
        className="inline-flex items-center text-sm text-primary-600 hover:underline mb-6"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Все клубы
      </Link>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
        <div className="h-32 w-32 rounded-full bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
          {club.logo_url ? (
            <img
              src={club.logo_url}
              alt={club.name}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <BuildingLibraryIcon className="h-14 w-14 text-gray-300" />
          )}
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {club.name}
          </h1>
          <p className="mt-2 text-gray-600">
            Состав клуба: {club.members.length}{" "}
            {club.members.length === 1
              ? "игрок"
              : club.members.length < 5
                ? "игрока"
                : "игроков"}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ФИО
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Город
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата вступления
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {club.members.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Состав пока не указан
                  </td>
                </tr>
              ) : (
                club.members.map((m) => (
                  <tr key={m.player_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {m.player_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {m.city || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {m.joined_at
                        ? formatDate(m.joined_at)
                        : m.created_at
                          ? formatDate(m.created_at)
                          : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ClubDetail;
