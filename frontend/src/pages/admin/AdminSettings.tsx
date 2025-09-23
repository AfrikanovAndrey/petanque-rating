import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { PlusIcon, TrashIcon, CogIcon } from "@heroicons/react/24/outline";
import { adminApi } from "../../services/api";
import { PositionPoints } from "../../types";
import { handleApiError } from "../../utils";

interface BestResultsForm {
  count: number;
}

interface PositionPointsForm {
  position: number;
  points: number;
}

const AdminSettings: React.FC = () => {
  const [isAddPositionModalOpen, setIsAddPositionModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Формы
  const bestResultsForm = useForm<BestResultsForm>();
  const positionPointsForm = useForm<PositionPointsForm>();

  // Загружаем данные
  const { data: positionPoints, isLoading: isLoadingPositions } = useQuery(
    "positionPoints",
    async () => {
      const response = await adminApi.getPositionPoints();
      return response.data.data || [];
    }
  );

  const { data: bestResultsCount, isLoading: isLoadingCount } = useQuery(
    "bestResultsCount",
    async () => {
      const response = await adminApi.getBestResultsCount();
      return response.data.data?.best_results_count || 8;
    }
  );

  // Устанавливаем значение по умолчанию для формы
  useEffect(() => {
    if (bestResultsCount) {
      bestResultsForm.setValue("count", bestResultsCount);
    }
  }, [bestResultsCount, bestResultsForm]);

  // Мутации
  const updateBestResultsMutation = useMutation(
    async (data: BestResultsForm) => {
      return await adminApi.setBestResultsCount(data.count);
    },
    {
      onSuccess: () => {
        toast.success("Настройка обновлена!");
        queryClient.invalidateQueries("bestResultsCount");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const addPositionMutation = useMutation(
    async (data: PositionPointsForm) => {
      return await adminApi.setPositionPoints(data.position, data.points);
    },
    {
      onSuccess: () => {
        toast.success("Очки за позицию добавлены!");
        queryClient.invalidateQueries("positionPoints");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
        setIsAddPositionModalOpen(false);
        positionPointsForm.reset();
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const deletePositionMutation = useMutation(
    async (position: number) => {
      return await adminApi.deletePositionPoints(position);
    },
    {
      onSuccess: () => {
        toast.success("Настройка удалена!");
        queryClient.invalidateQueries("positionPoints");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const updateBulkPositionsMutation = useMutation(
    async (positions: Array<{ position: number; points: number }>) => {
      return await adminApi.updatePositionPoints(positions);
    },
    {
      onSuccess: () => {
        toast.success("Все настройки обновлены!");
        queryClient.invalidateQueries("positionPoints");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const onSubmitBestResults = (data: BestResultsForm) => {
    updateBestResultsMutation.mutate(data);
  };

  const onSubmitPositionPoints = (data: PositionPointsForm) => {
    addPositionMutation.mutate(data);
  };

  const handleDeletePosition = (position: number) => {
    if (window.confirm(`Удалить настройку очков для ${position} места?`)) {
      deletePositionMutation.mutate(position);
    }
  };

  const generateDefaultPoints = () => {
    const defaultPositions = [];
    for (let i = 1; i <= 20; i++) {
      let points = 0;
      if (i === 1) points = 100;
      else if (i === 2) points = 90;
      else if (i === 3) points = 80;
      else if (i <= 5) points = 75 - (i - 4) * 5;
      else if (i <= 10) points = 65 - (i - 6) * 5;
      else if (i <= 20) points = 40 - (i - 11) * 2;

      defaultPositions.push({ position: i, points });
    }

    if (
      window.confirm(
        "Заменить текущие настройки на настройки по умолчанию (1-20 места)?"
      )
    ) {
      updateBulkPositionsMutation.mutate(defaultPositions);
    }
  };

  if (isLoadingPositions || isLoadingCount) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="loading-spinner mb-4"></div>
          <p className="text-gray-600">Загрузка настроек...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Настройки</h1>
        <p className="mt-2 text-gray-600">Конфигурация системы рейтинга</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Количество лучших результатов */}
        <div className="card p-6">
          <div className="flex items-center mb-4">
            <CogIcon className="h-5 w-5 text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">
              Количество лучших результатов
            </h2>
          </div>
          <p className="text-gray-600 mb-6">
            Количество лучших результатов турниров, которые учитываются при
            подсчете рейтинга игрока.
          </p>

          <form onSubmit={bestResultsForm.handleSubmit(onSubmitBestResults)}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Количество результатов
              </label>
              <input
                type="number"
                min="1"
                max="50"
                className="input-field"
                placeholder="8"
                {...bestResultsForm.register("count", {
                  required: "Количество обязательно",
                  min: { value: 1, message: "Минимум 1 результат" },
                  max: { value: 50, message: "Максимум 50 результатов" },
                })}
              />
              {bestResultsForm.formState.errors.count && (
                <p className="mt-1 text-sm text-red-600">
                  {bestResultsForm.formState.errors.count.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={updateBestResultsMutation.isLoading}
              className="btn-primary"
            >
              {updateBestResultsMutation.isLoading
                ? "Сохранение..."
                : "Сохранить"}
            </button>
          </form>
        </div>

        {/* Информация */}
        <div className="card p-6 bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            Как работает рейтинг?
          </h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>
              • Для каждого игрока берутся лучшие N результатов из всех турниров
            </p>
            <p>• Результаты суммируются для получения общего рейтинга</p>
            <p>• Очки за место в турнире настраиваются в таблице справа</p>
            <p>
              • При изменении настроек рейтинг пересчитывается автоматически
            </p>
          </div>
        </div>
      </div>

      {/* Настройки очков за позицию */}
      <div className="card p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Очки за позицию в турнире
            </h2>
            <p className="text-gray-600 mt-1">
              Настройте количество очков, которые игрок получает за каждое место
            </p>
          </div>
          <div className="flex space-x-3">
            <button onClick={generateDefaultPoints} className="btn-secondary">
              Настройки по умолчанию
            </button>
            <button
              onClick={() => setIsAddPositionModalOpen(true)}
              className="btn-primary flex items-center"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Добавить позицию
            </button>
          </div>
        </div>

        {positionPoints && positionPoints.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Место
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Очки
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {positionPoints
                  .sort(
                    (a: PositionPoints, b: PositionPoints) =>
                      a.position - b.position
                  )
                  .map((item: PositionPoints) => (
                    <tr key={item.position} className="table-row">
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.position} место
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {item.points} очков
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDeletePosition(item.position)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                          title="Удалить"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Нет настроек очков за позицию</p>
            <button
              onClick={() => setIsAddPositionModalOpen(true)}
              className="btn-primary"
            >
              Добавить первую позицию
            </button>
          </div>
        )}
      </div>

      {/* Модальное окно добавления позиции */}
      {isAddPositionModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                Добавить позицию
              </h3>
              <button
                onClick={() => setIsAddPositionModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={positionPointsForm.handleSubmit(onSubmitPositionPoints)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Место
                </label>
                <input
                  type="number"
                  min="1"
                  className="input-field"
                  placeholder="1"
                  {...positionPointsForm.register("position", {
                    required: "Место обязательно",
                    min: { value: 1, message: "Место должно быть больше 0" },
                  })}
                />
                {positionPointsForm.formState.errors.position && (
                  <p className="mt-1 text-sm text-red-600">
                    {positionPointsForm.formState.errors.position.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Очки
                </label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  placeholder="100"
                  {...positionPointsForm.register("points", {
                    required: "Очки обязательны",
                    min: {
                      value: 0,
                      message: "Очки не могут быть отрицательными",
                    },
                  })}
                />
                {positionPointsForm.formState.errors.points && (
                  <p className="mt-1 text-sm text-red-600">
                    {positionPointsForm.formState.errors.points.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddPositionModalOpen(false)}
                  className="btn-secondary"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={addPositionMutation.isLoading}
                  className="btn-primary"
                >
                  {addPositionMutation.isLoading ? "Добавление..." : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
