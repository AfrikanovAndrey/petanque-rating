import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  PlusIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  EyeIcon,
  CalendarIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { adminApi } from "../../services/api";
import { formatDate, formatDateTime, handleApiError } from "../../utils";

interface TournamentUploadForm {
  tournament_name: string;
  tournament_date: string;
  tournament_file: FileList;
}

const AdminTournaments: React.FC = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [fileError, setFileError] = useState<string>("");

  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TournamentUploadForm>();

  // Отслеживаем выбранный файл
  const selectedFile = watch("tournament_file");

  // Обработчик изменения файла
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setValue("tournament_file", files);
      setFileError(""); // Сбрасываем ошибку при выборе файла
    }
  };

  // Загружаем список турниров
  const {
    data: tournaments,
    isLoading,
    error,
  } = useQuery("tournaments", async () => {
    const response = await adminApi.getTournaments();
    return response.data.data || [];
  });

  // Мутация для загрузки турнира
  const uploadMutation = useMutation(
    async (data: TournamentUploadForm) => {
      const formData = new FormData();
      formData.append("tournament_name", data.tournament_name);
      formData.append("tournament_date", data.tournament_date);
      formData.append("tournament_file", data.tournament_file[0]);

      return await adminApi.uploadTournament(formData);
    },
    {
      onSuccess: (response) => {
        toast.success(response.data.message || "Турнир успешно загружен!");
        queryClient.invalidateQueries("tournaments");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
        setIsUploadModalOpen(false);
        reset();
        setFileError(""); // Сбрасываем ошибку файла
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  // Мутация для удаления турнира
  const deleteMutation = useMutation(
    async (tournamentId: number) => {
      return await adminApi.deleteTournament(tournamentId);
    },
    {
      onSuccess: () => {
        toast.success("Турнир удален!");
        queryClient.invalidateQueries("tournaments");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  // Мутация для получения деталей турнира
  const detailsMutation = useMutation(
    async (tournamentId: number) => {
      const response = await adminApi.getTournamentDetails(tournamentId);
      return response.data.data;
    },
    {
      onSuccess: (data) => {
        setSelectedTournament(data);
        setIsDetailsModalOpen(true);
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const onSubmit = (data: TournamentUploadForm) => {
    if (!selectedFile || selectedFile.length === 0) {
      setFileError("Файл с результатами обязателен");
      return;
    }

    // Устанавливаем файл в данные формы
    data.tournament_file = selectedFile;
    uploadMutation.mutate(data);
  };

  const handleDelete = (tournamentId: number, tournamentName: string) => {
    if (
      window.confirm(
        `Вы уверены, что хотите удалить турнир "${tournamentName}"? Это действие нельзя отменить.`
      )
    ) {
      deleteMutation.mutate(tournamentId);
    }
  };

  const handleViewDetails = (tournamentId: number) => {
    detailsMutation.mutate(tournamentId);
  };

  const handleOpenUploadModal = () => {
    setIsUploadModalOpen(true);
    setFileError(""); // Сбрасываем ошибку при открытии модального окна
    reset(); // Сбрасываем форму
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-600">Загрузка турниров...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">
          <p className="text-lg font-medium">Ошибка загрузки турниров</p>
          <p className="text-sm">{handleApiError(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и кнопка добавления */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Турниры</h1>
          <p className="mt-2 text-gray-600">
            Управление турнирами и результатами
          </p>
        </div>
        <button
          onClick={handleOpenUploadModal}
          className="btn-primary flex items-center"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Загрузить турнир
        </button>
      </div>

      {/* Список турниров */}
      <div className="card overflow-hidden">
        {tournaments && tournaments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Название
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата проведения
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата загрузки
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tournaments.map((tournament) => (
                  <tr key={tournament.id} className="table-row">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TrophyIcon className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {tournament.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                        {formatDate(tournament.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(tournament.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleViewDetails(tournament.id)}
                          disabled={detailsMutation.isLoading}
                          className="text-primary-600 hover:text-primary-900 p-1 rounded hover:bg-primary-50"
                          title="Просмотр результатов"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            handleDelete(tournament.id, tournament.name)
                          }
                          disabled={deleteMutation.isLoading}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Удалить турнир"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Нет турниров
            </h3>
            <p className="text-gray-500 mb-6">
              Загрузите первый турнир для начала работы с рейтингом
            </p>
            <button onClick={handleOpenUploadModal} className="btn-primary">
              Загрузить турнир
            </button>
          </div>
        )}
      </div>

      {/* Модальное окно загрузки турнира */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Загрузить турнир
              </h2>
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название турнира
                </label>
                <input
                  type="text"
                  className={`input-field ${
                    errors.tournament_name ? "border-red-300" : ""
                  }`}
                  placeholder="Введите название турнира"
                  {...register("tournament_name", {
                    required: "Название турнира обязательно",
                  })}
                />
                {errors.tournament_name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.tournament_name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Дата проведения
                </label>
                <input
                  type="date"
                  className={`input-field ${
                    errors.tournament_date ? "border-red-300" : ""
                  }`}
                  {...register("tournament_date", {
                    required: "Дата турнира обязательна",
                  })}
                />
                {errors.tournament_date && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.tournament_date.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Файл Excel с результатами
                </label>
                <div className="mt-1">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors"
                  >
                    <DocumentArrowUpIcon className="h-6 w-6 text-gray-400 mr-3" />
                    <div className="text-center">
                      <span className="text-gray-600">
                        {selectedFile && selectedFile.length > 0
                          ? selectedFile[0].name
                          : "Нажмите для выбора файла"}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Поддерживаются файлы .xlsx, .xls
                      </p>
                    </div>
                  </button>
                </div>
                {fileError && (
                  <p className="mt-1 text-sm text-red-600">{fileError}</p>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  Формат файла Excel:
                </h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• Первый столбец: ФИО игрока</li>
                  <li>• Второй столбец: Место в турнире (число)</li>
                  <li>• Первая строка может содержать заголовки</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="btn-secondary"
                  disabled={uploadMutation.isLoading}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={uploadMutation.isLoading}
                >
                  {uploadMutation.isLoading ? "Загрузка..." : "Загрузить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно с деталями турнира */}
      {isDetailsModalOpen && selectedTournament && (
        <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="card max-w-4xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedTournament.tournament.name}
                </h2>
                <p className="text-gray-600">
                  {formatDate(selectedTournament.tournament.date)}
                </p>
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Место
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Игрок
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Очки
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedTournament.results
                    .sort((a: any, b: any) => a.position - b.position)
                    .map((result: any, index: number) => (
                      <tr
                        key={result.id}
                        className={index < 3 ? "bg-yellow-50" : ""}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {result.position}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {result.player_name}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                          {result.points}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTournaments;
