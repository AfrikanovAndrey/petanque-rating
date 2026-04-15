import { ArrowLeftIcon, ClipboardDocumentListIcon } from "@heroicons/react/24/outline";
import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { Link, useParams } from "react-router-dom";
import { adminApi } from "../../services/api";
import {
  TournamentStatus,
  TournamentType,
} from "../../types";
import {
  formatDateTime,
  formatDateForInput,
  getTornamentCategoryText,
  getTournamentStatusText,
  handleApiError,
} from "../../utils";

interface TournamentParamsForm {
  name: string;
  date: string;
  type: TournamentType;
  category: string;
  status: TournamentStatus;
  manual: boolean;
  regulations: string;
}

const AdminTournamentRegistration: React.FC = () => {
  const { tournamentId: tournamentIdParam } = useParams<{
    tournamentId: string;
  }>();
  const tournamentId = parseInt(tournamentIdParam || "", 10);
  const queryClient = useQueryClient();

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

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<TournamentParamsForm>({
    defaultValues: {
      name: "",
      date: "",
      type: TournamentType.TRIPLETTE,
      category: "1",
      status: TournamentStatus.REGISTRATION,
      manual: false,
      regulations: "",
    },
  });

  useEffect(() => {
    if (!data?.tournament) return;
    const t = data.tournament;
    reset({
      name: t.name,
      date: formatDateForInput(t.date),
      type: t.type as TournamentType,
      category: t.category === "FEDERAL" ? "1" : "2",
      status: (t.status ?? TournamentStatus.REGISTRATION) as TournamentStatus,
      manual: !!t.manual,
      regulations: t.regulations ?? "",
    });
  }, [data, reset]);

  const updateMutation = useMutation(
    async (form: TournamentParamsForm) => {
      return adminApi.updateTournament(tournamentId, {
        name: form.name,
        type: form.type,
        category: form.category,
        date: form.date,
        status: form.status,
        manual: form.manual,
        regulations: form.regulations.trim() === "" ? null : form.regulations,
      });
    },
    {
      onSuccess: (res) => {
        if (res.data.success) {
          toast.success("Параметры турнира сохранены");
          void queryClient.invalidateQueries([
            "tournamentRegistration",
            tournamentId,
          ]);
        } else {
          toast.error(res.data.message || "Ошибка сохранения");
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
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
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Параметры турнира
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Измените поля и нажмите «Сохранить». Доступно организаторам и
            администраторам.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={handleSubmit((form) => updateMutation.mutate(form))}
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Название
            </label>
            <input
              type="text"
              className={`input-field ${errors.name ? "border-red-300" : ""}`}
              {...register("name", { required: "Укажите название" })}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата проведения
            </label>
            <input
              type="date"
              className={`input-field ${errors.date ? "border-red-300" : ""}`}
              {...register("date", { required: "Укажите дату" })}
            />
            {errors.date && (
              <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип турнира
            </label>
            <select
              className={`input-field ${errors.type ? "border-red-300" : ""}`}
              {...register("type", { required: true })}
            >
              <option value={TournamentType.TRIPLETTE}>Триплеты</option>
              <option value={TournamentType.DOUBLETTE_MALE}>
                Дуплеты мужские
              </option>
              <option value={TournamentType.DOUBLETTE_FEMALE}>
                Дуплеты женские
              </option>
              <option value={TournamentType.DOUBLETTE_MIXT}>
                Дуплеты микст
              </option>
              <option value={TournamentType.TET_A_TET_MALE}>
                Тет-а-тет мужской
              </option>
              <option value={TournamentType.TET_A_TET_FEMALE}>
                Тет-а-тет женский
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Категория
            </label>
            <select
              className={`input-field ${errors.category ? "border-red-300" : ""}`}
              {...register("category", { required: true })}
            >
              <option value="1">1-я категория ({getTornamentCategoryText("FEDERAL")})</option>
              <option value="2">2-я категория ({getTornamentCategoryText("REGIONAL")})</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Статус
            </label>
            <select
              className={`input-field ${errors.status ? "border-red-300" : ""}`}
              {...register("status", { required: true })}
            >
              <option value={TournamentStatus.REGISTRATION}>
                {getTournamentStatusText(TournamentStatus.REGISTRATION)}
              </option>
              <option value={TournamentStatus.IN_PROGRESS}>
                {getTournamentStatusText(TournamentStatus.IN_PROGRESS)}
              </option>
              <option value={TournamentStatus.FINISHED}>
                {getTournamentStatusText(TournamentStatus.FINISHED)}
              </option>
            </select>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="manual-mode"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600"
              {...register("manual")}
            />
            <label htmlFor="manual-mode" className="text-sm text-gray-700">
              Ручной режим загрузки результатов
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Регламент
            </label>
            <textarea
              rows={6}
              className={`input-field font-mono text-sm ${errors.regulations ? "border-red-300" : ""}`}
              placeholder="Текст регламента для участников…"
              {...register("regulations")}
            />
            <p className="mt-1 text-xs text-gray-500">
              Пустое поле удалит текст регламента в базе.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              className="btn-secondary"
              disabled={updateMutation.isLoading || !isDirty}
              onClick={() => {
                if (!data?.tournament) return;
                const t = data.tournament;
                reset({
                  name: t.name,
                  date: formatDateForInput(t.date),
                  type: t.type as TournamentType,
                  category: t.category === "FEDERAL" ? "1" : "2",
                  status: (t.status ?? TournamentStatus.REGISTRATION) as TournamentStatus,
                  manual: !!t.manual,
                  regulations: t.regulations ?? "",
                });
              }}
            >
              Сбросить
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={updateMutation.isLoading || !isDirty}
            >
              {updateMutation.isLoading ? "Сохранение…" : "Сохранить"}
            </button>
          </div>
        </form>

        <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600 border border-gray-100">
          <strong className="text-gray-700">Подсказка:</strong> при смене типа
          турнира проверьте соответствие уже записанных команд новым правилам
          состава на публичной странице регистрации.
        </div>
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
