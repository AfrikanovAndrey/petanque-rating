import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  PlusIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  CalendarIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import { adminApi } from "../../services/api";
import { formatDate, formatDateTime, handleApiError } from "../../utils";
import { getPointsReasonText } from "../../types";

interface TournamentUploadForm {
  tournament_name: string;
  tournament_date: string;
  tournament_file: FileList;
  tournament_category: "1" | "2";
  google_sheets_url: string;
}

const AdminTournaments: React.FC = () => {
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [fileError, setFileError] = useState<string>("");
  const [criticalErrors, setCriticalErrors] = useState<string[]>([]);
  const [uploadMode, setUploadMode] = useState<"file" | "google-sheets">(
    "file"
  );
  const [googleSheetsCheck, setGoogleSheetsCheck] = useState<{
    loading: boolean;
    result: any;
    error: string;
  }>({
    loading: false,
    result: null,
    error: "",
  });

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

  // Отслеживаем выбранный файл и URL Google Sheets
  const selectedFile = watch("tournament_file");
  const googleSheetsUrl = watch("google_sheets_url");

  // Обработчик изменения файла
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setValue("tournament_file", files);
      setFileError(""); // Сбрасываем ошибку при выборе файла
      setCriticalErrors([]); // Сбрасываем критические ошибки
    }
  };

  // Функция для проверки Google Sheets URL
  const checkGoogleSheetsUrl = async (url: string) => {
    if (!url || !url.includes("docs.google.com/spreadsheets")) {
      setGoogleSheetsCheck({
        loading: false,
        result: null,
        error: "Неверный формат ссылки на Google таблицу",
      });
      return;
    }

    setGoogleSheetsCheck({
      loading: true,
      result: null,
      error: "",
    });

    try {
      const response = await adminApi.checkGoogleSheetsAccess({ url });
      setGoogleSheetsCheck({
        loading: false,
        result: response.data.data,
        error: "",
      });
    } catch (error) {
      setGoogleSheetsCheck({
        loading: false,
        result: null,
        error: handleApiError(error),
      });
    }
  };

  // Обработчик изменения URL Google Sheets
  const handleGoogleSheetsUrlChange = (url: string) => {
    setValue("google_sheets_url", url);
    if (url.trim()) {
      // Добавляем небольшую задержку для уменьшения количества запросов
      const timeoutId = setTimeout(() => {
        checkGoogleSheetsUrl(url);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setGoogleSheetsCheck({
        loading: false,
        result: null,
        error: "",
      });
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
      if (uploadMode === "file") {
        const formData = new FormData();
        formData.append("tournament_name", data.tournament_name);
        formData.append("tournament_date", data.tournament_date);
        formData.append("tournament_file", data.tournament_file[0]);
        formData.append("tournament_category", data.tournament_category);

        return await adminApi.uploadTournament(formData);
      } else {
        return await adminApi.uploadTournamentFromGoogleSheets({
          tournament_name: data.tournament_name,
          tournament_date: data.tournament_date,
          google_sheets_url: data.google_sheets_url,
        });
      }
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
        setCriticalErrors([]); // Сбрасываем критические ошибки
      },
      onError: (error: any) => {
        const errorMessage = handleApiError(error);

        // Проверяем, является ли это ошибкой критической валидации
        if (errorMessage.includes("Критические ошибки")) {
          // Разбираем многострочную ошибку на отдельные критические ошибки
          const errorLines = errorMessage
            .split("\n")
            .filter((line) => line.trim() !== "");
          if (errorLines.length > 1) {
            // Первая строка - заголовок, остальные - детали ошибок
            setCriticalErrors(errorLines.slice(1));
            // НЕ показываем toast - ошибки отображаются в модалке
          } else {
            setCriticalErrors([errorMessage]);
            // НЕ показываем toast - ошибки отображаются в модалке
          }
        } else {
          // Обычные ошибки показываем в toast и закрываем модалку
          setCriticalErrors([]);
          toast.error(errorMessage);
        }
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
    if (uploadMode === "file") {
      if (!selectedFile || selectedFile.length === 0) {
        setFileError("Файл с результатами обязателен");
        return;
      }
      // Устанавливаем файл в данные формы
      data.tournament_file = selectedFile;
    } else {
      if (!googleSheetsUrl || !googleSheetsUrl.trim()) {
        toast.error("Ссылка на Google таблицу обязательна");
        return;
      }
      if (googleSheetsCheck.error) {
        toast.error("Исправьте ошибки с Google таблицей перед загрузкой");
        return;
      }
      data.google_sheets_url = googleSheetsUrl;
    }

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
    setCriticalErrors([]); // Сбрасываем критические ошибки
    setUploadMode("file"); // Сбрасываем режим загрузки
    setGoogleSheetsCheck({
      loading: false,
      result: null,
      error: "",
    }); // Сбрасываем состояние проверки Google Sheets
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
                        <TrophyIcon className="h-6 w-6 text-gray-400 mr-3" />
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
                          className="text-primary-600 hover:text-primary-900 p-1 rounded hover:bg-primary-50 text-sm font-medium"
                          title="Просмотр результатов"
                        >
                          Результаты
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
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
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
                  Категория турнира
                </label>
                <select
                  className="input-field"
                  {...register("tournament_category", {
                    required: "Категория турнира обязательна",
                  })}
                >
                  <option value="1">1-я категория</option>
                  <option value="2">2-я категория</option>
                </select>
                {errors.tournament_category && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.tournament_category.message}
                  </p>
                )}
              </div>

              {/* Выбор способа загрузки */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Способ загрузки данных
                </label>
                <div className="flex space-x-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="file"
                      checked={uploadMode === "file"}
                      onChange={(e) =>
                        setUploadMode(
                          e.target.value as "file" | "google-sheets"
                        )
                      }
                      className="mr-2"
                    />
                    📄 Загрузить Excel файл
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="google-sheets"
                      checked={uploadMode === "google-sheets"}
                      onChange={(e) =>
                        setUploadMode(
                          e.target.value as "file" | "google-sheets"
                        )
                      }
                      className="mr-2"
                    />
                    🔗 Google Таблица
                  </label>
                </div>
              </div>

              {/* Секция загрузки файла */}
              {uploadMode === "file" && (
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

                  {/* Отображение критических ошибок валидации */}
                  {criticalErrors.length > 0 && (
                    <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="mr-2">⚠️</span>
                          Критические ошибки в файле:
                        </div>
                        <span className="text-xs font-normal bg-red-200 px-2 py-1 rounded-full">
                          {criticalErrors.length} ошибок
                        </span>
                      </h4>

                      {/* Пролистываемый список ошибок */}
                      <div className="max-h-60 overflow-y-auto border border-red-300 rounded bg-white p-2 mb-3">
                        <ul className="space-y-1">
                          {criticalErrors.map((error, index) => (
                            <li
                              key={index}
                              className="text-xs text-red-700 flex items-start py-1 border-b border-red-100 last:border-b-0"
                            >
                              <span className="mr-2 mt-0.5 text-red-500 font-bold">
                                {index + 1}.
                              </span>
                              <span className="flex-1">{error}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                        <p className="font-medium mb-1">💡 Как исправить:</p>
                        <ul className="space-y-1">
                          <li>
                            • Убедитесь, что в файле есть лист "Лист
                            регистрации" с командами
                          </li>
                          <li>
                            • Проверьте наличие листов "Кубок A" и "Кубок Б" с
                            результатами
                          </li>
                          <li>
                            • Все игроки в результатах кубков должны быть
                            зарегистрированы в листе регистрации
                          </li>
                          <li>
                            • Для неоднозначных игроков укажите полное имя
                            (Фамилия Имя) или инициалы (Фамилия И.)
                          </li>
                          <li>
                            • Игроки с полным именем будут автоматически
                            добавлены в базу данных
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Секция Google Sheets */}
              {uploadMode === "google-sheets" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ссылка на Google Таблицу
                  </label>
                  <div className="mt-1">
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      {...register("google_sheets_url", {
                        required:
                          uploadMode === "google-sheets"
                            ? "Ссылка на Google таблицу обязательна"
                            : false,
                        pattern: {
                          value: /docs\.google\.com\/spreadsheets/,
                          message: "Неверный формат ссылки на Google таблицу",
                        },
                      })}
                      onChange={(e) =>
                        handleGoogleSheetsUrlChange(e.target.value)
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Убедитесь, что таблица открыта для просмотра всем, у кого
                      есть ссылка
                    </p>
                  </div>

                  {/* Состояние проверки URL */}
                  {googleSheetsCheck.loading && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center">
                        <div className="loading-spinner mr-2"></div>
                        <span className="text-sm text-blue-800">
                          Проверяем доступность таблицы...
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Ошибка проверки */}
                  {googleSheetsCheck.error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center">
                        <span className="text-sm text-red-800">
                          ❌ {googleSheetsCheck.error}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Успешная проверка */}
                  {googleSheetsCheck.result && !googleSheetsCheck.error && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm text-green-800">
                        <div className="flex items-center mb-2">
                          <span className="mr-2">✅</span>
                          <span className="font-medium">
                            Таблица доступна для чтения
                          </span>
                        </div>
                        <div className="text-xs">
                          <p>
                            Найдено листов:{" "}
                            {googleSheetsCheck.result.totalSheets}
                          </p>
                          <p className="mt-1">
                            Листы:{" "}
                            {googleSheetsCheck.result.sheetNames.join(", ")}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {errors.google_sheets_url && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.google_sheets_url.message}
                    </p>
                  )}

                  {/* Отображение критических ошибок для Google Sheets */}
                  {criticalErrors.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                      <h4 className="text-sm font-semibold text-red-900 mb-2 flex items-center">
                        <span className="mr-2">⚠️</span>
                        Критические ошибки в файле:
                        <span className="ml-auto bg-red-200 text-red-900 px-2 py-1 rounded text-xs">
                          {criticalErrors.length} ошибок
                        </span>
                      </h4>

                      {/* Пролистываемый список ошибок */}
                      <div className="max-h-60 overflow-y-auto border border-red-300 rounded bg-white p-2 mb-3">
                        <ul className="space-y-1">
                          {criticalErrors.map((error, index) => (
                            <li
                              key={index}
                              className="text-xs text-red-700 flex items-start py-1 border-b border-red-100 last:border-b-0"
                            >
                              <span className="mr-2 mt-0.5 text-red-500 font-bold">
                                {index + 1}.
                              </span>
                              <span className="flex-1">{error}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                        <p className="font-medium mb-1">💡 Как исправить:</p>
                        <ul className="space-y-1">
                          <li>
                            • Убедитесь, что в таблице есть лист "Лист
                            регистрации" с командами
                          </li>
                          <li>
                            • Проверьте наличие листов "Кубок A" и "Кубок Б" с
                            результатами
                          </li>
                          <li>
                            • Все игроки в результатах кубков должны быть
                            зарегистрированы в листе регистрации
                          </li>
                          <li>
                            • Для неоднозначных игроков укажите полное имя
                            (Фамилия Имя) или инициалы (Фамилия И.)
                          </li>
                          <li>
                            • Игроки с полным именем будут автоматически
                            добавлены в базу данных
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
          <div className="card max-w-4xl w-full max-h-[80vh] flex flex-col">
            {/* Заголовок - фиксированный */}
            <div className="flex justify-between items-center p-6 pb-4 border-b border-gray-200 flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {selectedTournament.tournament.name}
                </h2>
                <p className="text-gray-600">
                  {formatDate(selectedTournament.tournament.date)}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsDetailsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Содержимое - скроллируемое */}
            <div className="overflow-y-auto flex-1 p-6 pt-4">
              {(() => {
                // Группируем результаты по кубкам
                const cupA = selectedTournament.results.filter(
                  (result: any) => result.cup === "A"
                );
                const cupB = selectedTournament.results.filter(
                  (result: any) => result.cup === "B"
                );

                const sortResults = (results: any[]) => {
                  return results.sort((a: any, b: any) => {
                    // Порядок позиций по приоритету (лучшие позиции первыми)
                    const positionPriority: Record<string, number> = {
                      WINNER: 1,
                      "1": 1, // тоже победитель
                      RUNNER_UP: 2,
                      "2": 2, // тоже второе место
                      THIRD_PLACE: 3,
                      "3": 3, // тоже третье место
                      SEMI_FINAL: 4,
                      "1/2": 4, // полуфинал
                      QUARTER_FINAL: 5,
                      "1/4": 5, // четвертьфинал
                    };

                    const aPriority = positionPriority[a.points_reason] || 999;
                    const bPriority = positionPriority[b.points_reason] || 999;

                    return aPriority - bPriority;
                  });
                };

                const renderCupTable = (results: any[], cupTitle: string) => {
                  if (results.length === 0) return null;

                  const sortedResults = sortResults(results);

                  return (
                    <div key={cupTitle} className="mb-6">
                      <div className="mb-4">
                        <h4 className="text-md font-medium text-gray-900">
                          {cupTitle}
                        </h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Место
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Команда
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {sortedResults.map((result: any, index: number) => (
                              <tr
                                key={result.id}
                                className={index < 3 ? "bg-yellow-50" : ""}
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <div className="text-sm font-medium text-gray-900">
                                      {getPointsReasonText(
                                        result.points_reason,
                                        result.cup,
                                        result.qualifyingWins
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                  <div className="flex flex-col">
                                    <span className="font-semibold">
                                      {result.team_players}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-6">
                    {renderCupTable(cupA, "Кубок A")}
                    {renderCupTable(cupB, "Кубок B")}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTournaments;
