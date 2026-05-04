import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CalendarIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
} from "@heroicons/react/24/outline";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { adminApi, createBlankTournament } from "../../services/api";
import {
  getCupPositionText,
  TournamentStatus,
  TournamentType,
  UserRole,
} from "../../types";
import {
  formatDate,
  formatDateForInput,
  formatDateTime,
  getTornamentCategoryText,
  getTournamentStatusText,
  getTournamentTypeIcons,
  handleApiError,
} from "../../utils";
import TournamentResultsUploadModal from "../../components/admin/TournamentResultsUploadModal";

interface TournamentEditForm {
  name: string;
  date: string;
  type: TournamentType;
  category: string;
  status: TournamentStatus;
}

interface TournamentCreateBlankForm {
  name: string;
  date: string;
  type: string;
  category: string;
  regulations: string;
}

const AdminTournaments: React.FC = () => {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [replaceResultsModalOpen, setReplaceResultsModalOpen] = useState(false);
  const [replaceResultsTournament, setReplaceResultsTournament] = useState<
    { id: number; name: string; date: string; type: TournamentType; category: string } | null
  >(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<any>(null);
  const [editingTournament, setEditingTournament] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const queryClient = useQueryClient();

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    formState: { errors: errorsEdit },
    reset: resetEdit,
  } = useForm<TournamentEditForm>();

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    formState: { errors: errorsCreate },
    reset: resetCreate,
  } = useForm<TournamentCreateBlankForm>({
    defaultValues: {
      name: "",
      date: "",
      type: "",
      category: "1",
      regulations: "",
    },
  });

  const { data: currentUser } = useQuery(
    "adminCurrentUser",
    async () => {
      const response = await adminApi.getCurrentUser();
      return response.data.data ?? null;
    },
    { staleTime: 60_000 }
  );

  const canCreateBlankTournament =
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.MANAGER;

  // Загружаем список турниров
  const {
    data: tournaments,
    isLoading,
    error,
  } = useQuery("tournaments", async () => {
    const response = await adminApi.getTournaments();
    const data = response.data.data || [];
    // Сортируем по дате проведения, самые свежие вверху
    return data.sort((a: any, b: any) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  });

  const createBlankMutation = useMutation(
    async (data: TournamentCreateBlankForm) => {
      return await createBlankTournament({
        name: data.name,
        date: data.date,
        type: data.type as TournamentType,
        category: data.category,
        regulations: data.regulations,
      });
    },
    {
      onSuccess: (response) => {
        toast.success(response.data.message || "Турнир создан");
        queryClient.invalidateQueries("tournaments");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
        setIsCreateModalOpen(false);
        resetCreate();
        const newId = response.data.data?.id;
        if (typeof newId === "number" && newId > 0) {
          navigate(`/admin/tournaments/${newId}/draft`);
        }
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  // Мутация для обновления турнира
  const updateMutation = useMutation(
    async (data: { id: number; updateData: TournamentEditForm }) => {
      return await adminApi.updateTournament(data.id, {
        name: data.updateData.name,
        type: data.updateData.type,
        category: data.updateData.category,
        date: data.updateData.date,
        status: data.updateData.status,
      });
    },
    {
      onSuccess: () => {
        toast.success("Турнир успешно обновлен!");
        queryClient.invalidateQueries("tournaments");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
        setIsEditModalOpen(false);
        resetEdit();
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

  // Мутация для пересчёта очков конкретного турнира
  const recalculateMutation = useMutation(
    async (tournamentId: number) => {
      return await adminApi.recalculateTournamentPointsById(tournamentId);
    },
    {
      onSuccess: () => {
        toast.success("Очки турнира пересчитаны!");
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

  const handleOpenEditModal = (tournament: any) => {
    setEditingTournament(tournament);
    resetEdit({
      name: tournament.name,
      type: tournament.type,
      category: tournament.category === "FEDERAL" ? "1" : "2",
      date: formatDateForInput(tournament.date),
      status: tournament.status ?? TournamentStatus.FINISHED,
    });
    setIsEditModalOpen(true);
  };

  const onSubmitEdit = (data: TournamentEditForm) => {
    if (!editingTournament) return;
    updateMutation.mutate({
      id: editingTournament.id,
      updateData: data,
    });
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
    resetCreate({
      name: "",
      date: "",
      type: "",
      category: "1",
      regulations: "",
    });
  };

  const onSubmitCreateBlank = (data: TournamentCreateBlankForm) => {
    createBlankMutation.mutate(data);
  };

  const handleOpenUploadModal = () => {
    setIsUploadModalOpen(true);
  };

  const openReplaceResultsModal = (tournament: {
    id: number;
    name: string;
    date: string;
    type: TournamentType;
    category: string;
  }) => {
    setReplaceResultsTournament(tournament);
    setReplaceResultsModalOpen(true);
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
      {/* Кнопки всегда на отдельной строке под заголовком */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Турниры</h1>
          <p className="mt-2 text-gray-600">
            Управление турнирами и результатами
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          {canCreateBlankTournament && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="btn-secondary inline-flex shrink-0 items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2 shrink-0" />
              Создать новый турнир
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenUploadModal}
            className="btn-primary inline-flex shrink-0 items-center"
          >
            <PlusIcon className="h-5 w-5 mr-2 shrink-0" />
            Загрузить турнир
          </button>
        </div>
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
                    Категория
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Статус
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Режим загрузки
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Количество команд
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата загрузки
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tournaments.map((tournament) => {
                  const isRegistration =
                    tournament.status === TournamentStatus.REGISTRATION;
                  const isInProgress =
                    tournament.status === TournamentStatus.IN_PROGRESS;
                  const isDraft = tournament.status === TournamentStatus.DRAFT;
                  const opensSnapshotView =
                    isRegistration || isInProgress || isDraft;
                  return (
                  <tr
                    key={tournament.id}
                    className={`table-row ${
                      opensSnapshotView
                        ? "cursor-pointer hover:bg-gray-50"
                        : ""
                    }`}
                    onClick={
                      opensSnapshotView
                        ? () =>
                            navigate(
                              isDraft
                                ? `/admin/tournaments/${tournament.id}/draft`
                                : isRegistration
                                  ? `/admin/tournaments/${tournament.id}/registration`
                                  : `/admin/tournaments/${tournament.id}/in-progress`
                            )
                        : undefined
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <TrophyIcon className="h-6 w-6 text-gray-400 mr-3" />
                        <div className="flex items-center">
                          {opensSnapshotView ? (
                            <span className="text-sm font-medium text-gray-900">
                              {tournament.name}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewDetails(tournament.id);
                              }}
                              disabled={detailsMutation.isLoading}
                              className="text-sm font-medium text-gray-900 hover:text-primary-600 hover:underline text-left cursor-pointer"
                              title="Просмотр результатов"
                            >
                              {tournament.name}
                            </button>
                          )}
                          {getTournamentTypeIcons(tournament.type)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <CalendarIcon className="h-4 w-4 text-gray-400 mr-2" />
                        {formatDate(tournament.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        {getTornamentCategoryText(tournament.category)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center justify-center">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            tournament.status === TournamentStatus.DRAFT
                              ? "bg-slate-200 text-slate-800"
                              : tournament.status === TournamentStatus.REGISTRATION
                                ? "bg-amber-100 text-amber-900"
                                : tournament.status ===
                                    TournamentStatus.IN_PROGRESS
                                  ? "bg-sky-100 text-sky-900"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {getTournamentStatusText(tournament.status)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center justify-center">
                        {tournament.status === TournamentStatus.FINISHED ? (
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${
                              tournament.manual
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {tournament.manual ? "Ручной" : "Автоматический"}
                          </span>
                        ) : (
                          <span className="text-gray-400">–</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center justify-center">
                        {tournament.teams_count ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(tournament.created_at)}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() =>
                            recalculateMutation.mutate(tournament.id)
                          }
                          disabled={
                            tournament.manual ||
                            (recalculateMutation.isLoading &&
                              recalculateMutation.variables === tournament.id)
                          }
                          className={`p-1 rounded ${
                            tournament.manual
                              ? "text-gray-300 cursor-not-allowed"
                              : "text-amber-600 hover:text-amber-900 hover:bg-amber-50"
                          }`}
                          title={
                            tournament.manual
                              ? "Недоступно для турниров с ручным вводом"
                              : "Пересчитать очки турнира"
                          }
                        >
                          <ArrowPathIcon
                            className={`h-4 w-4 ${
                              recalculateMutation.isLoading &&
                              recalculateMutation.variables === tournament.id
                                ? "animate-spin"
                                : ""
                            }`}
                          />
                        </button>
                        {tournament.status === TournamentStatus.FINISHED && (
                          <button
                            type="button"
                            onClick={() =>
                              openReplaceResultsModal({
                                id: tournament.id,
                                name: tournament.name,
                                date: tournament.date,
                                type: tournament.type,
                                category: tournament.category,
                              })
                            }
                            className="text-emerald-600 hover:text-emerald-900 p-1 rounded hover:bg-emerald-50"
                            title="Заменить результаты турнира (Excel или Google Таблицы)"
                          >
                            <ArrowUpTrayIcon className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(tournament)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                          title="Редактировать турнир"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        {currentUser?.role === UserRole.ADMIN && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDelete(tournament.id, tournament.name)
                            }
                            disabled={deleteMutation.isLoading}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                            title="Удалить турнир"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
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
            <div className="flex flex-wrap gap-3 justify-center">
              {canCreateBlankTournament && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="btn-secondary"
                >
                  Создать новый турнир
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenUploadModal}
                className="btn-primary"
              >
                Загрузить турнир
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Создание турнира без загрузки результатов */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Создать новый турнир
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmitCreate(onSubmitCreateBlank)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название
                </label>
                <input
                  type="text"
                  className={`input-field ${
                    errorsCreate.name ? "border-red-300" : ""
                  }`}
                  placeholder="Введите название турнира"
                  {...registerCreate("name", {
                    required: "Название обязательно",
                  })}
                />
                {errorsCreate.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsCreate.name.message}
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
                    errorsCreate.date ? "border-red-300" : ""
                  }`}
                  {...registerCreate("date", {
                    required: "Дата обязательна",
                  })}
                />
                {errorsCreate.date && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsCreate.date.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип турнира
                </label>
                <select
                  className={`input-field ${
                    errorsCreate.type ? "border-red-300" : ""
                  }`}
                  {...registerCreate("type", {
                    required: "Тип турнира обязателен",
                  })}
                >
                  <option value="">Выберите тип турнира</option>
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
                {errorsCreate.type && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsCreate.type.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Категория турнира
                </label>
                <select
                  className="input-field"
                  {...registerCreate("category", {
                    required: "Категория обязательна",
                  })}
                >
                  <option value="1">1-я категория</option>
                  <option value="2">2-я категория</option>
                </select>
                {errorsCreate.category && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsCreate.category.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Регламент
                </label>
                <textarea
                  rows={5}
                  className="input-field"
                  placeholder="Текст регламента (необязательно)"
                  {...registerCreate("regulations")}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-secondary"
                  disabled={createBlankMutation.isLoading}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createBlankMutation.isLoading}
                >
                  {createBlankMutation.isLoading ? "Создание..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TournamentResultsUploadModal
        variant="new-tournament"
        open={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />
      <TournamentResultsUploadModal
        variant="replace-finished"
        open={replaceResultsModalOpen}
        onClose={() => {
          setReplaceResultsModalOpen(false);
          setReplaceResultsTournament(null);
        }}
        tournament={replaceResultsTournament ?? undefined}
        onAfterSuccess={() => {
          const t = replaceResultsTournament;
          if (
            t &&
            isDetailsModalOpen &&
            selectedTournament?.id === t.id
          ) {
            detailsMutation.mutate(t.id);
          }
        }}
      />

      {/* Модальное окно редактирования турнира */}
      {isEditModalOpen && editingTournament && (
        <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Редактировать турнир
              </h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSubmitEdit(onSubmitEdit)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Название турнира
                </label>
                <input
                  type="text"
                  className={`input-field ${
                    errorsEdit.name ? "border-red-300" : ""
                  }`}
                  placeholder="Введите название турнира"
                  {...registerEdit("name", {
                    required: "Название турнира обязательно",
                  })}
                />
                {errorsEdit.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsEdit.name.message}
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
                    errorsEdit.date ? "border-red-300" : ""
                  }`}
                  {...registerEdit("date", {
                    required: "Дата турнира обязательна",
                  })}
                />
                {errorsEdit.date && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsEdit.date.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип турнира
                </label>
                <select
                  className={`input-field ${
                    errorsEdit.type ? "border-red-300" : ""
                  }`}
                  {...registerEdit("type", {
                    required: "Тип турнира обязателен",
                  })}
                >
                  <option value="">Выберите тип турнира</option>
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
                {errorsEdit.type && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsEdit.type.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Категория турнира
                </label>
                <select
                  className={`input-field ${
                    errorsEdit.category ? "border-red-300" : ""
                  }`}
                  {...registerEdit("category", {
                    required: "Категория турнира обязательна",
                  })}
                >
                  <option value="1">1-я категория</option>
                  <option value="2">2-я категория</option>
                </select>
                {errorsEdit.category && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsEdit.category.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Статус турнира
                </label>
                <select
                  className={`input-field ${
                    errorsEdit.status ? "border-red-300" : ""
                  }`}
                  {...registerEdit("status", {
                    required: "Статус турнира обязателен",
                  })}
                >
                  <option value={TournamentStatus.DRAFT}>
                    {getTournamentStatusText(TournamentStatus.DRAFT)}
                  </option>
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
                {errorsEdit.status && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsEdit.status.message}
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
                      ROUND_OF_4: 4,
                      "1/2": 4, // полуфинал
                      ROUND_OF_8: 5,
                      "1/4": 5, // четвертьфинал
                      ROUND_OF_16: 6,
                      "1/8": 6, // 1/8 финала
                    };

                    const aPriority = positionPriority[a.cup_position] || 999;
                    const bPriority = positionPriority[b.cup_position] || 999;

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
                            {sortedResults.map((result: any) => (
                              <tr key={result.id}>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex flex-col">
                                    <div className="text-sm font-medium text-gray-900">
                                      {getCupPositionText(
                                        result.cup_position,
                                        result.cup
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
