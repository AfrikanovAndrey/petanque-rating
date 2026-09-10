import { BuildingLibraryIcon } from "@heroicons/react/24/outline";
import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "react-query";
import { clubsApi } from "../services/api";
import { handleApiError } from "../utils";

const Clubs: React.FC = () => {
  const {
    data: clubs,
    isLoading,
    error,
  } = useQuery(
    "public-clubs",
    async () => {
      const response = await clubsApi.getClubs();
      return response.data.data ?? [];
    },
    { staleTime: 5 * 60 * 1000 }
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
        <BuildingLibraryIcon className="h-8 w-8 text-primary-600" />
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Клубы</h1>
      </div>

      {(clubs ?? []).length === 0 ? (
        <p className="text-gray-500">Клубы пока не добавлены.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(clubs ?? []).map((club) => (
            <Link
              key={club.id}
              to={`/clubs/${club.id}`}
              className="group flex flex-col items-center text-center p-6 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition"
            >
              <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden mb-4">
                {club.logo_url ? (
                  <img
                    src={club.logo_url}
                    alt={club.name}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <BuildingLibraryIcon className="h-12 w-12 text-gray-300" />
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-primary-700">
                {club.name}
              </h2>
              {typeof club.members_count === "number" && (
                <p className="mt-1 text-sm text-gray-500">
                  {club.members_count}{" "}
                  {club.members_count === 1
                    ? "игрок"
                    : club.members_count < 5
                      ? "игрока"
                      : "игроков"}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default Clubs;
