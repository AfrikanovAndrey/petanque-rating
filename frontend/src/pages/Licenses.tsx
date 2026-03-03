import { IdentificationIcon } from "@heroicons/react/24/outline";
import React from "react";
import { useQuery } from "react-query";
import { ratingApi } from "../services/api";
import { formatDate, handleApiError } from "../utils";

const Licenses: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const {
    data: licenses,
    isLoading,
    error,
  } = useQuery(
    "active-licenses",
    async () => {
      const response = await ratingApi.getActiveLicenses();
      return response.data.data ?? [];
    },
    { staleTime: 5 * 60 * 1000 },
  );

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="text-lg text-gray-600">Загрузка...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Ошибка загрузки: {handleApiError(error)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-6">
        <IdentificationIcon className="h-8 w-8 text-primary-600" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Действующие лицензии
        </h1>
      </div>
      <p className="text-gray-600 mb-2">
        Список лицензий на {currentYear} календарный год.
      </p>
      <p className="text-gray-700 font-medium mb-6">
        Всего: {(licenses ?? []).length} лицензий.
      </p>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  ФИО
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Дата
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  № лицензии
                </th>
                <th
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  Город
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(licenses ?? []).map((row, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {row.player_name}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(row.license_date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {row.license_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {row.city ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(!licenses || licenses.length === 0) && (
          <div className="text-center py-12 text-gray-500">
            Нет действующих лицензий на {currentYear} год.
          </div>
        )}
      </div>
    </div>
  );
};

export default Licenses;
