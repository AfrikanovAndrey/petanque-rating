import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import {
  PencilIcon,
  TrashIcon,
  UsersIcon,
  MagnifyingGlassIcon,
  ArrowUpTrayIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";
import { adminApi } from "../../services/api";
import { Player } from "../../types";
import { formatDateTime, handleApiError } from "../../utils";

// Функция для форматирования отображения пола
const formatGender = (gender: string | null | undefined): string => {
  if (!gender) return "—";
  switch (gender.toLowerCase()) {
    case "male":
      return "М";
    case "female":
      return "Ж";
    default:
      return "—";
  }
};

interface EditPlayerForm {
  name: string;
  gender: string;
  city?: string;
}

const AdminPlayers: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkUploadModalOpen, setIsBulkUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<EditPlayerForm>();

  // Загружаем игроков
  const {
    data: players,
    isLoading,
    error,
  } = useQuery("players", async () => {
    const response = await adminApi.getPlayers();
    return response.data.data || [];
  });

  // Мутация для создания игрока
  const createMutation = useMutation(
    async (data: { name: string; gender: string; city?: string }) => {
      return await adminApi.createPlayer(data);
    },
    {
      onSuccess: () => {
        toast.success("Игрок успешно создан!");
        queryClient.invalidateQueries("players");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
        setIsCreateModalOpen(false);
        reset();
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  // Мутация для обновления игрока
  const updateMutation = useMutation(
    async (data: {
      id: number;
      name: string;
      gender: string;
      city?: string;
    }) => {
      return await adminApi.updatePlayer(data.id, {
        name: data.name,
        gender: data.gender,
        city: data.city,
      });
    },
    {
      onSuccess: () => {
        toast.success("Игрок обновлен!");
        queryClient.invalidateQueries("players");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
        setIsEditModalOpen(false);
        setEditingPlayer(null);
        reset();
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  // Мутация для удаления игрока
  const deleteMutation = useMutation(
    async (playerId: number) => {
      return await adminApi.deletePlayer(playerId);
    },
    {
      onSuccess: () => {
        toast.success("Игрок удален!");
        queryClient.invalidateQueries("players");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  // Мутация для массовой загрузки игроков из текстового файла
  const bulkUploadMutation = useMutation(
    async (file: File) => {
      const formData = new FormData();
      formData.append("players_file", file);
      return await adminApi.uploadPlayersFromText(formData);
    },
    {
      onSuccess: (response) => {
        toast.success(response.data.message || "Игроки успешно загружены!");
        queryClient.invalidateQueries("players");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
        setIsBulkUploadModalOpen(false);
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const openCreateModal = () => {
    reset();
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    reset();
  };

  const openBulkUploadModal = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsBulkUploadModalOpen(true);
  };

  const closeBulkUploadModal = () => {
    setIsBulkUploadModalOpen(false);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Проверяем расширение файла
      if (!file.name.toLowerCase().endsWith(".txt")) {
        toast.error("Пожалуйста, выберите текстовый файл (.txt)");
        event.target.value = "";
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleBulkUpload = () => {
    if (!selectedFile) {
      toast.error("Пожалуйста, выберите файл");
      return;
    }

    bulkUploadMutation.mutate(selectedFile);
  };

  const openEditModal = (player: Player) => {
    setEditingPlayer(player);
    setValue("name", player.name);
    setValue("gender", player.gender);
    setValue("city", player.city || "");
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingPlayer(null);
    reset();
  };

  const onSubmitCreate = (data: EditPlayerForm) => {
    createMutation.mutate({
      name: data.name.trim(),
      gender: data.gender,
      city: data.city?.trim() || undefined,
    });
  };

  const onSubmitEdit = (data: EditPlayerForm) => {
    if (editingPlayer) {
      updateMutation.mutate({
        id: editingPlayer.id,
        name: data.name.trim(),
        gender: data.gender,
        city: data.city?.trim() || undefined,
      });
    }
  };

  const handleDelete = (player: Player) => {
    if (
      window.confirm(
        `Вы уверены, что хотите удалить игрока "${player.name}"? Это действие удалит все его результаты и нельзя будет отменить.`
      )
    ) {
      deleteMutation.mutate(player.id);
    }
  };

  // Фильтрация игроков по поисковому запросу
  const filteredPlayers =
    players?.filter((player) =>
      player.name.toLowerCase().includes(searchQuery.toLowerCase())
    ) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-600">Загрузка игроков...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">
          <p className="text-lg font-medium">Ошибка загрузки игроков</p>
          <p className="text-sm">{handleApiError(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и кнопки */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Игроки</h1>
          <p className="mt-2 text-gray-600">Управление профилями игроков</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openBulkUploadModal}
            className="btn-secondary flex items-center"
          >
            <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
            Загрузить из файла
          </button>
          <button
            onClick={openCreateModal}
            className="btn-primary flex items-center"
          >
            <UsersIcon className="h-5 w-5 mr-2" />
            Создать игрока
          </button>
        </div>
      </div>

      {/* Поиск и статистика */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Поиск игроков..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10"
          />
        </div>

        <div className="text-sm text-gray-500">
          Показано: {filteredPlayers.length} из {players?.length || 0} игроков
        </div>
      </div>

      {/* Список игроков */}
      <div className="card overflow-hidden">
        {filteredPlayers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ФИО
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Пол
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Город
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата добавления
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Последнее изменение
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="table-row">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center mr-3">
                          <span className="text-primary-600 font-medium text-sm">
                            {player.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {player.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatGender(player.gender)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {player.city || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(player.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(player.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(player)}
                          className="text-primary-600 hover:text-primary-900 p-1 rounded hover:bg-primary-50"
                          title="Редактировать"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(player)}
                          disabled={deleteMutation.isLoading}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Удалить"
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
            {searchQuery ? (
              <>
                <MagnifyingGlassIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Игроки не найдены
                </h3>
                <p className="text-gray-500">
                  Попробуйте изменить поисковый запрос
                </p>
              </>
            ) : (
              <>
                <UsersIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Нет игроков
                </h3>
                <p className="text-gray-500">
                  Игроки будут добавлены автоматически при загрузке результатов
                  турниров
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Информация */}
      <div className="card p-6 bg-blue-50 border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          Управление игроками
        </h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p>
            • Игроки автоматически создаются при загрузке результатов турниров
          </p>
          <p>• Вы можете редактировать имена игроков для исправления ошибок</p>
          <p>• Удаление игрока также удалит все его результаты из турниров</p>
          <p>• Используйте поиск для быстрого нахождения нужного игрока</p>
        </div>
      </div>

      {/* Модальное окно редактирования */}
      {isEditModalOpen && editingPlayer && (
        <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Редактировать игрока
              </h3>
              <button
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ФИО игрока
                </label>
                <input
                  type="text"
                  className={`input-field ${
                    errors.name ? "border-red-300" : ""
                  }`}
                  placeholder="Введите ФИО игрока"
                  {...register("name", {
                    required: "ФИО обязательно",
                    minLength: {
                      value: 2,
                      message: "ФИО должно содержать минимум 2 символа",
                    },
                  })}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Пол
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="male"
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      {...register("gender", {
                        required: "Пол обязателен",
                      })}
                    />
                    <span className="ml-2 text-sm text-gray-700">Мужской</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="female"
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      {...register("gender", {
                        required: "Пол обязателен",
                      })}
                    />
                    <span className="ml-2 text-sm text-gray-700">Женский</span>
                  </label>
                </div>
                {errors.gender && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.gender.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Город
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Введите город"
                  {...register("city")}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="btn-secondary"
                  disabled={updateMutation.isLoading}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={updateMutation.isLoading}
                >
                  {updateMutation.isLoading ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно создания */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Создать игрока
              </h3>
              <button
                onClick={closeCreateModal}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmitCreate)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ФИО игрока
                </label>
                <input
                  type="text"
                  className={`input-field ${
                    errors.name ? "border-red-300" : ""
                  }`}
                  placeholder="Иванов Иван"
                  {...register("name", {
                    required: "ФИО обязательно",
                    minLength: {
                      value: 2,
                      message: "ФИО должно содержать минимум 2 символа",
                    },
                    validate: {
                      hasFullName: (value) => {
                        const parts = value.trim().split(/\s+/);
                        if (parts.length < 2) {
                          return "Укажите Фамилию и Имя (например: Иванов Иван)";
                        }
                        // Проверяем, что вторая часть не является инициалом
                        const secondPart = parts[1];
                        if (/^[А-ЯA-Z]\.?$/.test(secondPart)) {
                          return "Нельзя использовать инициалы. Укажите полное имя (например: Иванов Иван)";
                        }
                        return true;
                      },
                    },
                  })}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Пол
                </label>
                <div className="flex gap-6">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="male"
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      {...register("gender", {
                        required: "Пол обязателен",
                      })}
                    />
                    <span className="ml-2 text-sm text-gray-700">Мужской</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      value="female"
                      className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                      {...register("gender", {
                        required: "Пол обязателен",
                      })}
                    />
                    <span className="ml-2 text-sm text-gray-700">Женский</span>
                  </label>
                </div>
                {errors.gender && (
                  <p className="mt-2 text-sm text-red-600">
                    {errors.gender.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Город
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Введите город"
                  {...register("city")}
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="btn-secondary"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isLoading}
                >
                  {createMutation.isLoading ? "Создание..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Модальное окно массовой загрузки */}
      {isBulkUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="card max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Массовая загрузка игроков из текстового файла
              </h3>
              <button
                onClick={closeBulkUploadModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={bulkUploadMutation.isLoading}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Информация о формате файла */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <DocumentTextIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-2">
                      Формат текстового файла:
                    </p>
                    <ul className="space-y-1 ml-4 list-disc">
                      <li>Каждая строка содержит данные одного игрока</li>
                      <li>
                        Формат строки:{" "}
                        <code className="bg-blue-100 px-1 rounded">
                          имя, город
                        </code>{" "}
                        или{" "}
                        <code className="bg-blue-100 px-1 rounded">
                          имя, пол, город
                        </code>
                      </li>
                      <li>
                        Примеры:{" "}
                        <code className="bg-blue-100 px-1 rounded">
                          Иванов Иван, Москва
                        </code>{" "}
                        или{" "}
                        <code className="bg-blue-100 px-1 rounded">
                          Петрова Анна, female, Казань
                        </code>
                      </li>
                      <li>
                        Имя должно содержать минимум Фамилию и Имя (не инициалы)
                      </li>
                      <li>
                        Пол может быть: male, female, m, f, м, ж (или не указан)
                      </li>
                      <li>
                        Если игрок уже существует, будут обновлены его пол и
                        город
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Пример содержимого файла */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Пример содержимого файла:
                </p>
                <pre className="text-xs text-gray-600 bg-white p-3 rounded border border-gray-200">
                  {`Потапов Вячеслав, male, Краснодар
Панфилова Любовь, female, Анапа
Иванов Иван, м, Москва
Петрова Анна, ж, Санкт-Петербург
Сидоров Дмитрий, Казань`}
                </pre>
                <p className="mt-2 text-xs text-gray-500">
                  * Если пол не указан в файле, будет установлен мужской пол по
                  умолчанию
                </p>
              </div>

              {/* Выбор файла */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Выберите текстовый файл (.txt)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileSelect}
                  disabled={bulkUploadMutation.isLoading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 disabled:opacity-50"
                />
                {selectedFile && (
                  <p className="mt-2 text-sm text-gray-600">
                    Выбран файл:{" "}
                    <span className="font-medium">{selectedFile.name}</span>
                  </p>
                )}
              </div>

              {/* Кнопки действий */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={closeBulkUploadModal}
                  className="btn-secondary"
                  disabled={bulkUploadMutation.isLoading}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleBulkUpload}
                  className="btn-primary flex items-center"
                  disabled={!selectedFile || bulkUploadMutation.isLoading}
                >
                  {bulkUploadMutation.isLoading ? (
                    <>
                      <div className="loading-spinner-sm mr-2"></div>
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
                      Загрузить
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPlayers;
