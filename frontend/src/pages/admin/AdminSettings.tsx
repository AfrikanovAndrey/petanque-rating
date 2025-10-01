import React, { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { CogIcon } from "@heroicons/react/24/outline";
import { adminApi } from "../../services/api";
import { handleApiError } from "../../utils";

interface BestResultsForm {
  count: number;
}

const AdminSettings: React.FC = () => {
  const queryClient = useQueryClient();

  // Формы
  const bestResultsForm = useForm<BestResultsForm>();

  // Загружаем данные

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

  const onSubmitBestResults = (data: BestResultsForm) => {
    updateBestResultsMutation.mutate(data);
  };

  if (isLoadingCount) {
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
            <p>• Очки за место в турнире рассчитываются автоматически</p>
            <p>
              • При изменении настроек рейтинг пересчитывается автоматически
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
