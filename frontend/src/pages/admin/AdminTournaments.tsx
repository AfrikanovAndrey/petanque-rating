import {
  ArrowPathIcon,
  ArrowUpTrayIcon,
  BellAlertIcon,
  PencilIcon,
  PlusIcon,
  ShieldCheckIcon,
  TrashIcon,
  TrophyIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "react-query";
import { adminApi, createBlankTournament } from "../../services/api";
import {
  applyTournamentListFilters,
  buildYearTabs,
  cn,
  filterTournamentsByYear,
  formatDate,
  formatDateForInput,
  formatDateTime,
  getTornamentCategoryText,
  tournamentCategoryToFormValue,
  getTournamentStatusText,
  getTournamentTypeIcons,
  hasAnyUserRole,
  canManageTournamentData,
  handleApiError,
  hasActiveTournamentFilters,
  loadAdminTournamentFiltersFromCookie,
  saveAdminTournamentFiltersToCookie,
  TOURNAMENT_FILTER_ADMIN_STATUS_OPTIONS,
  type TournamentListFilters,
} from "../../utils";
import TournamentResultsUploadModal from "../../components/admin/TournamentResultsUploadModal";
import TournamentListFiltersPanel from "../../components/TournamentListFiltersPanel";
import {
  Tournament,
  TournamentStatus,
  TournamentType,
  UserRole,
} from "../../types";

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
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [filters, setFilters] = useState<TournamentListFilters>(() =>
    loadAdminTournamentFiltersFromCookie()
  );
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [replaceResultsModalOpen, setReplaceResultsModalOpen] = useState(false);
  const [replaceResultsTournament, setReplaceResultsTournament] = useState<
    { id: number; name: string; date: string; type: TournamentType; category: string } | null
  >(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(
    null
  );
  const [organizerModalTournament, setOrganizerModalTournament] =
    useState<Tournament | null>(null);
  const [organizerModalUserId, setOrganizerModalUserId] = useState<number | "">(
    ""
  );

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

  const canManageTournaments = hasAnyUserRole(currentUser, [
    UserRole.ADMIN,
    UserRole.MANAGER,
  ]);

  const isAdmin = hasAnyUserRole(currentUser, [UserRole.ADMIN]);

  const canValidateResults = hasAnyUserRole(currentUser, [
    UserRole.ADMIN,
    UserRole.PRESIDIUM_MEMBER,
  ]);

  const { data: staffUsers } = useQuery(
    "tournamentOrganizerCandidates",
    async () => {
      const response = await adminApi.getUsers();
      const users = response.data.users || [];
      return users.filter((u: { id: number; role?: UserRole; roles?: UserRole[] }) =>
        hasAnyUserRole(u, [UserRole.ADMIN, UserRole.MANAGER])
      );
    },
    { enabled: isAdmin, staleTime: 60_000 }
  );

  // Загружаем список турниров
  const {
    data: tournaments,
    isLoading,
    error,
  } = useQuery("tournaments", async () => {
    const response = await adminApi.getTournaments();
    const data = response.data.data || [];
    // Сортируем по дате проведения, самые свежие вверху
    return (data as Tournament[]).sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  });

  const yearTabs = useMemo(
    () =>
      tournaments?.length
        ? buildYearTabs(tournaments, currentYear, {
            includeNextYearWhenHasTournaments: true,
          })
        : [],
    [tournaments, currentYear]
  );

  useEffect(() => {
    if (yearTabs.length === 0) {
      return;
    }
    setSelectedYear((prev) =>
      prev !== null && yearTabs.includes(prev) ? prev : yearTabs[0]
    );
  }, [yearTabs]);

  useEffect(() => {
    saveAdminTournamentFiltersToCookie(filters);
  }, [filters]);

  const yearTournaments = useMemo(() => {
    if (!tournaments || selectedYear === null) {
      return [];
    }
    return filterTournamentsByYear(tournaments, selectedYear);
  }, [tournaments, selectedYear]);

  const displayedTournaments = useMemo(
    () => applyTournamentListFilters(yearTournaments, filters),
    [yearTournaments, filters]
  );

  const filtersActive = hasActiveTournamentFilters(filters);

  const validateMutation = useMutation(
    async (tournamentId: number) => {
      return await adminApi.validateTournamentResults(tournamentId);
    },
    {
      onSuccess: () => {
        toast.success(
          "Результаты турнира признаны и учитываются в рейтинге"
        );
        queryClient.invalidateQueries("tournaments");
        queryClient.invalidateQueries("fullRating");
        queryClient.invalidateQueries("dashboardRating");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

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
        setEditingTournament(null);
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

  const setOrganizerMutation = useMutation(
    async (data: { tournamentId: number; organizerUserId: number }) => {
      return await adminApi.setTournamentOrganizer(
        data.tournamentId,
        data.organizerUserId
      );
    },
    {
      onSuccess: () => {
        toast.success("Организатор турнира обновлён");
        queryClient.invalidateQueries("tournaments");
        setOrganizerModalTournament(null);
        setOrganizerModalUserId("");
      },
      onError: (error) => {
        toast.error(handleApiError(error));
      },
    }
  );

  const openOrganizerModal = (tournament: Tournament) => {
    setOrganizerModalTournament(tournament);
    setOrganizerModalUserId(tournament.organizer_user_id ?? "");
  };

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

  const handleDelete = (tournamentId: number, tournamentName: string) => {
    if (
      window.confirm(
        `Вы уверены, что хотите удалить турнир "${tournamentName}"? Это действие нельзя отменить.`
      )
    ) {
      deleteMutation.mutate(tournamentId);
    }
  };

  const handleOpenEditModal = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setIsEditModalOpen(true);
    resetEdit({
      name: tournament.name,
      type: tournament.type,
      category: tournamentCategoryToFormValue(tournament.category),
      date: formatDateForInput(String(tournament.date ?? "")),
      status: tournament.status ?? TournamentStatus.FINISHED,
    });
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
          {canManageTournaments && (
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="btn-secondary inline-flex shrink-0 items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2 shrink-0" />
              Создать новый турнир
            </button>
          )}
          {canManageTournaments && (
            <button
              type="button"
              onClick={handleOpenUploadModal}
              className="btn-primary inline-flex shrink-0 items-center"
            >
              <PlusIcon className="h-5 w-5 mr-2 shrink-0" />
              Загрузить результаты турнира
            </button>
          )}
        </div>
      </div>

      {/* Вкладки по годам */}
      {yearTabs.length > 0 && selectedYear !== null && (
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Турниры по годам"
        >
          {yearTabs.map((year) => (
            <button
              key={year}
              type="button"
              role="tab"
              aria-selected={selectedYear === year}
              onClick={() => setSelectedYear(year)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                selectedYear === year
                  ? "bg-primary-600 text-white shadow"
                  : "bg-white text-gray-700 shadow hover:bg-gray-50"
              )}
            >
              {year}
            </button>
          ))}
        </div>
      )}

      {tournaments && tournaments.length > 0 && (
        <div className="w-full">
          <TournamentListFiltersPanel
            filters={filters}
            onChange={setFilters}
            statusOptions={TOURNAMENT_FILTER_ADMIN_STATUS_OPTIONS}
            panelId="admin-tournament-filters-panel"
            adaptOptionsToViewport
          />
        </div>
      )}

      {/* Список турниров */}
      <div className="card overflow-hidden">
        {tournaments && tournaments.length > 0 ? (
          yearTournaments.length > 0 ? (
          displayedTournaments.length > 0 ? (
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
                    Количество команд
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Режим загрузки
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Учёт в рейтинге
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Организатор
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата обновления
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayedTournaments.map((tournament: Tournament) => {
                  const isRegistration =
                    tournament.status === TournamentStatus.REGISTRATION;
                  const isFinalRegistration =
                    tournament.status === TournamentStatus.FINAL_REGISTRATION;
                  const isInProgress =
                    tournament.status === TournamentStatus.IN_PROGRESS;
                  const isDraft = tournament.status === TournamentStatus.DRAFT;
                  const isFinished =
                    tournament.status === TournamentStatus.FINISHED;
                  const canManageThis = canManageTournamentData(
                    currentUser,
                    tournament
                  );
                  const opensSnapshotView =
                    isFinished ||
                    ((isRegistration ||
                      isFinalRegistration ||
                      isInProgress ||
                      isDraft) &&
                      canManageThis);
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
                                  : isFinalRegistration
                                    ? `/admin/tournaments/${tournament.id}/final-registration`
                                    : isFinished
                                      ? `/admin/tournaments/${tournament.id}/finished`
                                      : `/admin/tournaments/${tournament.id}/in-progress`
                            )
                        : undefined
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">                    
                        <div className="flex items-center">
                          <span className="text-sm font-medium text-gray-900">
                            {tournament.name}
                          </span>
                          {getTournamentTypeIcons(tournament.type)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">                      
                        {formatDate(tournament.date)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        {getTornamentCategoryText(tournament.category)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            tournament.status === TournamentStatus.DRAFT
                              ? "bg-slate-200 text-slate-800"
                              : tournament.status === TournamentStatus.REGISTRATION
                                ? "bg-amber-100 text-amber-900"
                                : tournament.status ===
                                    TournamentStatus.FINAL_REGISTRATION
                                  ? "bg-emerald-100 text-emerald-900"
                                  : tournament.status ===
                                      TournamentStatus.IN_PROGRESS
                                    ? "bg-sky-100 text-sky-900"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {getTournamentStatusText(tournament.status)}
                        </span>
                        {(isRegistration || isFinalRegistration) &&
                          (tournament.pending_registration_teams_count ?? 0) >
                            0 && (
                          <span
                            className="inline-flex shrink-0"
                            title="Есть заявки, ожидающие подтверждения"
                          >
                            <BellAlertIcon
                              className="h-5 w-5 text-amber-600"
                              aria-hidden
                            />
                            <span className="sr-only">
                              Есть заявки, ожидающие подтверждения
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center justify-center">
                        {tournament.teams_count ?? 0}
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
                            {tournament.manual ? "Ручной" : "Авторасчёт"}
                          </span>
                        ) : (
                          <span className="text-gray-400">–</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center justify-center">
                        {tournament.status === TournamentStatus.FINISHED ? (
                          tournament.results_validated_at ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                              Признан
                            </span>
                          ) : (tournament.teams_count ?? 0) > 0 ? (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-900">
                              Ожидает
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {tournament.organizer?.name ||
                        tournament.organizer?.username ||
                        (tournament.organizer_user_id != null
                          ? `#${tournament.organizer_user_id}`
                          : "—")}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end space-x-2">
                        {canValidateResults &&
                          tournament.status === TournamentStatus.FINISHED &&
                          (tournament.teams_count ?? 0) > 0 &&
                          !tournament.results_validated_at && (
                            <button
                              type="button"
                              onClick={() =>
                                validateMutation.mutate(tournament.id)
                              }
                              disabled={
                                validateMutation.isLoading &&
                                validateMutation.variables === tournament.id
                              }
                              className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50 disabled:opacity-50"
                              title="Признать результаты для учёта в рейтинге"
                            >
                              <ShieldCheckIcon
                                className={`h-4 w-4 ${
                                  validateMutation.isLoading &&
                                  validateMutation.variables === tournament.id
                                    ? "animate-pulse"
                                    : ""
                                }`}
                              />
                            </button>
                          )}
                        {canManageThis && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                recalculateMutation.mutate(tournament.id)
                              }
                              disabled={
                                tournament.manual ||
                                (recalculateMutation.isLoading &&
                                  recalculateMutation.variables ===
                                    tournament.id)
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
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenEditModal(tournament);
                              }}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                              title="Редактировать турнир"
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {hasAnyUserRole(currentUser, [UserRole.ADMIN]) && (
                          <>
                            <button
                              type="button"
                              onClick={() => openOrganizerModal(tournament)}
                              className="text-indigo-600 hover:text-indigo-900 p-1 rounded hover:bg-indigo-50"
                              title="Сменить организатора"
                            >
                              <UserCircleIcon className="h-4 w-4" />
                            </button>
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
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDateTime(tournament.updated_at)}
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
              <p className="text-gray-500 mb-4">
                {filtersActive
                  ? "Нет турниров по выбранным фильтрам"
                  : `За ${selectedYear} год турниры пока не созданы`}
              </p>
              {filtersActive && (
                <button
                  type="button"
                  onClick={() =>
                    setFilters({ statuses: [], types: [], categories: [] })
                  }
                  className="text-sm font-medium text-primary-600 hover:text-primary-800"
                >
                  Сбросить фильтры
                </button>
              )}
            </div>
          )
          ) : (
            <div className="text-center py-12">
              <TrophyIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Нет турниров
              </h3>
              <p className="text-gray-500">
                За {selectedYear} год турниры пока не созданы
              </p>
            </div>
          )
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
              {canManageTournaments && (
                <button
                  type="button"
                  onClick={handleOpenCreateModal}
                  className="btn-secondary"
                >
                  Создать новый турнир
                </button>
              )}
              {canManageTournaments && (
                <button
                  type="button"
                  onClick={handleOpenUploadModal}
                  className="btn-primary"
                >
                  Загрузить турнир
                </button>
              )}
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
                  <option value={TournamentType.DOUBLETTE_ANY}>
                    Дуплеты смешанные
                  </option>
                  <option value={TournamentType.TET_A_TET_MALE}>
                    Тет-а-тет мужской
                  </option>
                  <option value={TournamentType.TET_A_TET_FEMALE}>
                    Тет-а-тет женский
                  </option>
                  <option value={TournamentType.TET_A_TET_ANY}>
                    Тет-а-тет смешанный
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
                  <option value="1">1-я категория (РФП)</option>
                  <option value="2">2-я категория (Региональный)</option>
                  <option value="3">Клубный</option>
                </select>
                {errorsCreate.category && (
                  <p className="mt-1 text-sm text-red-600">
                    {errorsCreate.category.message}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                Описание
                </label>
                <textarea
                  rows={5}
                  className="input-field"
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
          void queryClient.invalidateQueries("tournaments");
        }}
      />

      {/* Модальное окно редактирования турнира */}
      {isEditModalOpen &&
        editingTournament &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-gray-600 bg-opacity-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-tournament-title"
            onClick={() => {
              setIsEditModalOpen(false);
              setEditingTournament(null);
            }}
          >
            <div
              className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex justify-between items-center mb-6">
              <h2
                id="edit-tournament-title"
                className="text-xl font-semibold text-gray-900"
              >
                Редактировать турнир
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingTournament(null);
                }}
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
                  <option value={TournamentType.DOUBLETTE_ANY}>
                    Дуплеты смешанные
                  </option>
                  <option value={TournamentType.TET_A_TET_MALE}>
                    Тет-а-тет мужской
                  </option>
                  <option value={TournamentType.TET_A_TET_FEMALE}>
                    Тет-а-тет женский
                  </option>
                  <option value={TournamentType.TET_A_TET_ANY}>
                    Тет-а-тет смешанный
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
                  <option value="1">1-я категория (РФП)</option>
                  <option value="2">2-я категория (Региональный)</option>
                  <option value="3">Клубный</option>
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
                  <option value={TournamentStatus.FINAL_REGISTRATION}>
                    {getTournamentStatusText(
                      TournamentStatus.FINAL_REGISTRATION
                    )}
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

              {isAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Организатор турнира
                  </label>
                  <p className="text-sm text-gray-600 mb-2">
                    {editingTournament.organizer?.name ||
                      editingTournament.organizer?.username ||
                      "Не назначен"}
                    . Чтобы сменить — кнопка с иконкой пользователя в колонке
                    «Действия».
                  </p>
                </div>
              )}

              {!isAdmin && editingTournament.organizer && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Организатор</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {editingTournament.organizer.name ||
                      editingTournament.organizer.username}
                  </p>
                </div>
              )}

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
        </div>,
        document.body
      )}
      {/* Модальное окно смены организатора (ADMIN) */}
      {organizerModalTournament &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] bg-gray-600 bg-opacity-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              setOrganizerModalTournament(null);
              setOrganizerModalUserId("");
            }}
          >
            <div
              className="card max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Сменить организатора
              </h2>
              <button
                type="button"
                onClick={() => {
                  setOrganizerModalTournament(null);
                  setOrganizerModalUserId("");
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Турнир:{" "}
              <span className="font-medium text-gray-900">
                {organizerModalTournament.name}
              </span>
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Организатор
            </label>
            <select
              className="input-field mb-4"
              value={
                organizerModalUserId === ""
                  ? ""
                  : String(organizerModalUserId)
              }
              onChange={(e) => {
                const v = e.target.value;
                setOrganizerModalUserId(v === "" ? "" : Number(v));
              }}
            >
              <option value="" disabled>
                Выберите пользователя
              </option>
              {(staffUsers ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username})
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn-secondary"
                disabled={setOrganizerMutation.isLoading}
                onClick={() => {
                  setOrganizerModalTournament(null);
                  setOrganizerModalUserId("");
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={
                  setOrganizerMutation.isLoading ||
                  organizerModalUserId === "" ||
                  organizerModalUserId ===
                    organizerModalTournament.organizer_user_id
                }
                onClick={() => {
                  if (organizerModalUserId === "") {
                    return;
                  }
                  setOrganizerMutation.mutate({
                    tournamentId: organizerModalTournament.id,
                    organizerUserId: Number(organizerModalUserId),
                  });
                }}
              >
                {setOrganizerMutation.isLoading ? "Сохранение…" : "Сохранить"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminTournaments;
