import { DocumentArrowUpIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "react-query";
import { adminApi } from "../../services/api";
import { TournamentCategory, TournamentType } from "../../types";
import {
  formatDate,
  getTornamentCategoryText,
  getTournamentTypeIcons,
  getTournamentTypeText,
  handleApiError,
} from "../../utils";

export type TournamentResultsUploadVariant =
  | "new-tournament"
  | "replace-finished"
  | "complete-in-progress";

interface TournamentUploadForm {
  tournament_name: string;
  tournament_date: string;
  tournament_type: TournamentType;
  tournament_file: FileList;
  tournament_category: string;
  google_sheets_url: string;
}

export interface TournamentResultsUploadModalTournament {
  id: number;
  name: string;
  date: string;
  type: TournamentType;
  category: string;
}

export interface TournamentResultsUploadModalProps {
  variant: TournamentResultsUploadVariant;
  open: boolean;
  onClose: () => void;
  /** Для replace-finished и complete-in-progress */
  tournament?: TournamentResultsUploadModalTournament | null;
  /** После успешной загрузки (навигация и т.п.) */
  onAfterSuccess?: () => void;
}

function CriticalErrorsPanel(props: {
  criticalErrors: string[];
  criticalErrorsHeader: string;
}) {
  const { criticalErrors, criticalErrorsHeader } = props;
  if (criticalErrors.length === 0) return null;
  return (
    <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
      <h4 className="text-sm font-semibold text-red-800 mb-2 flex items-center justify-between">
        <div className="flex items-center">
          <span className="mr-2">⚠️</span>
          {criticalErrorsHeader || "Критические ошибки в файле:"}
        </div>
        <span className="text-xs font-normal bg-red-200 px-2 py-1 rounded-full">
          {criticalErrors.length} ошибок
        </span>
      </h4>
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
          <li>• Переименовать листы, колонки в таблицах</li>
          <li>
            • Все игроки на листах швейцарки / групп / кубков должны
            присутствовать на листе регистрации
          </li>
          <li>
            • Каждый игрок должен быть однозначно определён. Для однофамильцев
            стоит указать имя или инициалы
          </li>
          <li>
            • Игроки с полным именем будут автоматически добавлены в базу
            данных
          </li>
        </ul>
      </div>
    </div>
  );
}

const TournamentResultsUploadModal: React.FC<
  TournamentResultsUploadModalProps
> = ({ variant, open, onClose, tournament, onAfterSuccess }) => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadMode, setUploadMode] = useState<"file" | "google-sheets">(
    "file"
  );
  const [fileError, setFileError] = useState("");
  const [criticalErrors, setCriticalErrors] = useState<string[]>([]);
  const [criticalErrorsHeader, setCriticalErrorsHeader] = useState("");
  const [googleSheetsCheck, setGoogleSheetsCheck] = useState<{
    loading: boolean;
    result: {
      spreadsheetId: string;
      sheetNames: string[];
      totalSheets: number;
    } | null;
    error: string;
  }>({ loading: false, result: null, error: "" });

  const [existingSelectedFile, setExistingSelectedFile] =
    useState<FileList | null>(null);
  const [existingGoogleUrl, setExistingGoogleUrl] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TournamentUploadForm>();

  const selectedFile = watch("tournament_file");
  const newTournamentGoogleUrl = watch("google_sheets_url");

  const applyApiErrorToCritical = (error: unknown) => {
    const errorMessage = handleApiError(error);
    const errorLines = errorMessage
      .split("\n")
      .filter((line) => line.trim() !== "");
    if (errorLines.length > 1 && errorLines[0].startsWith("#")) {
      setCriticalErrorsHeader(errorLines[0].slice(1));
      setCriticalErrors(errorLines.slice(1));
    } else {
      setCriticalErrors(errorLines);
      setCriticalErrorsHeader("");
    }
  };

  const resetExistingSourceState = () => {
    setUploadMode("file");
    setFileError("");
    setCriticalErrors([]);
    setCriticalErrorsHeader("");
    setGoogleSheetsCheck({ loading: false, result: null, error: "" });
    setExistingSelectedFile(null);
    setExistingGoogleUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!open) return;
    if (variant === "new-tournament") {
      reset();
      setUploadMode("file");
      setFileError("");
      setCriticalErrors([]);
      setCriticalErrorsHeader("");
      setGoogleSheetsCheck({ loading: false, result: null, error: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } else {
      resetExistingSourceState();
    }
  }, [open, variant, reset, tournament?.id]);

  const checkGoogleSheetsUrl = async (url: string) => {
    if (!url || !url.includes("docs.google.com/spreadsheets")) {
      setGoogleSheetsCheck({
        loading: false,
        result: null,
        error: "Неверный формат ссылки на Google таблицу",
      });
      return;
    }
    setGoogleSheetsCheck({ loading: true, result: null, error: "" });
    try {
      const response = await adminApi.checkGoogleSheetsAccess({ url });
      setGoogleSheetsCheck({
        loading: false,
        result: response.data.data ?? null,
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

  useEffect(() => {
    if (!open || variant !== "new-tournament") return;
    const url = (newTournamentGoogleUrl || "").trim();
    if (!url) {
      setGoogleSheetsCheck({ loading: false, result: null, error: "" });
      return;
    }
    const t = setTimeout(() => void checkGoogleSheetsUrl(url), 500);
    return () => clearTimeout(t);
  }, [newTournamentGoogleUrl, open, variant]);

  const invalidateRatingQueries = () => {
    void queryClient.invalidateQueries("tournaments");
    void queryClient.invalidateQueries("fullRating");
    void queryClient.invalidateQueries("dashboardRating");
  };

  const uploadNewMutation = useMutation(
    async (data: TournamentUploadForm) => {
      if (uploadMode === "file") {
        const formData = new FormData();
        formData.append("tournament_name", data.tournament_name);
        formData.append("tournament_date", data.tournament_date);
        formData.append("tournament_type", data.tournament_type);
        formData.append("tournament_file", data.tournament_file[0]);
        formData.append("tournament_category", data.tournament_category);
        return await adminApi.uploadTournament(formData);
      }
      return await adminApi.uploadTournamentFromGoogleSheets({
        tournament_name: data.tournament_name,
        tournament_date: data.tournament_date,
        tournament_type: data.tournament_type,
        tournament_category: data.tournament_category,
        google_sheets_url: data.google_sheets_url,
      });
    },
    {
      onSuccess: (response) => {
        toast.success(response.data.message || "Турнир успешно загружен!");
        invalidateRatingQueries();
        onClose();
        onAfterSuccess?.();
      },
      onError: (error: unknown) => {
        applyApiErrorToCritical(error);
      },
    }
  );

  const replaceFinishedExcelMutation = useMutation(
    async (payload: { tournamentId: number; file: File }) =>
      adminApi.replaceFinishedTournamentResultsFromExcel(
        payload.tournamentId,
        payload.file
      ),
    {
      onSuccess: (res) => {
        if (res.data.success) {
          toast.success(
            res.data.message || "Результаты турнира полностью заменены"
          );
          invalidateRatingQueries();
          onAfterSuccess?.();
          onClose();
        } else {
          toast.error(res.data.message || "Не удалось заменить результаты");
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const replaceFinishedGoogleMutation = useMutation(
    async (payload: { tournamentId: number; url: string }) =>
      adminApi.replaceFinishedTournamentResultsFromGoogleSheets(
        payload.tournamentId,
        { google_sheets_url: payload.url }
      ),
    {
      onSuccess: (res) => {
        if (res.data.success) {
          toast.success(
            res.data.message || "Результаты турнира полностью заменены"
          );
          invalidateRatingQueries();
          onAfterSuccess?.();
          onClose();
        } else {
          toast.error(res.data.message || "Не удалось заменить результаты");
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const completeExcelMutation = useMutation(
    async (payload: { tournamentId: number; file: File }) =>
      adminApi.completeInProgressTournamentFromExcel(
        payload.tournamentId,
        payload.file
      ),
    {
      onSuccess: (res, variables) => {
        if (res.data.success) {
          toast.success(
            res.data.message || "Результаты загружены, турнир завершён"
          );
          invalidateRatingQueries();
          void queryClient.invalidateQueries([
            "tournamentInProgress",
            variables.tournamentId,
          ]);
          onAfterSuccess?.();
          onClose();
        } else {
          toast.error(res.data.message || "Не удалось загрузить результаты");
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const completeGoogleMutation = useMutation(
    async (payload: { tournamentId: number; url: string }) =>
      adminApi.completeInProgressTournamentFromGoogleSheets(
        payload.tournamentId,
        { google_sheets_url: payload.url }
      ),
    {
      onSuccess: (res, variables) => {
        if (res.data.success) {
          toast.success(
            res.data.message || "Результаты загружены, турнир завершён"
          );
          invalidateRatingQueries();
          void queryClient.invalidateQueries([
            "tournamentInProgress",
            variables.tournamentId,
          ]);
          onAfterSuccess?.();
          onClose();
        } else {
          toast.error(res.data.message || "Не удалось загрузить результаты");
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const existingBusy =
    replaceFinishedExcelMutation.isLoading ||
    replaceFinishedGoogleMutation.isLoading ||
    completeExcelMutation.isLoading ||
    completeGoogleMutation.isLoading;

  const handleNewSubmit = (data: TournamentUploadForm) => {
    setCriticalErrors([]);
    setCriticalErrorsHeader("");
    if (uploadMode === "file") {
      if (!selectedFile || selectedFile.length === 0) {
        setFileError("Файл с результатами обязателен");
        return;
      }
      data.tournament_file = selectedFile;
    } else {
      const g = (data.google_sheets_url || "").trim();
      if (!g) {
        toast.error("Ссылка на Google таблицу обязательна");
        return;
      }
      if (googleSheetsCheck.error) {
        toast.error("Исправьте ошибки с Google таблицей перед загрузкой");
        return;
      }
      data.google_sheets_url = g;
    }
    uploadNewMutation.mutate(data);
  };

  const handleExistingFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setExistingSelectedFile(files);
      setFileError("");
      setCriticalErrors([]);
      setCriticalErrorsHeader("");
    }
  };

  const submitExisting = () => {
    if (!tournament) return;
    setCriticalErrors([]);
    setCriticalErrorsHeader("");
    const tid = tournament.id;

    if (uploadMode === "file") {
      const f = existingSelectedFile?.[0];
      if (!f) {
        setFileError("Файл с результатами обязателен");
        return;
      }
      const msgFinish =
        "Загрузить результаты из выбранного Excel и завершить турнир? Дата, тип и категория в файле должны совпадать с карточкой турнира.";
      const msgReplace =
        "Все текущие результаты турнира будут удалены и записаны заново из Excel. Дата, тип и категория в файле должны совпадать с карточкой турнира. Продолжить?";
      if (
        !window.confirm(
          variant === "complete-in-progress" ? msgFinish : msgReplace
        )
      ) {
        return;
      }
      if (variant === "replace-finished") {
        replaceFinishedExcelMutation.mutate({ tournamentId: tid, file: f });
      } else {
        completeExcelMutation.mutate({ tournamentId: tid, file: f });
      }
      return;
    }

    const url = existingGoogleUrl.trim();
    if (!url || !url.includes("docs.google.com/spreadsheets")) {
      toast.error("Укажите корректную ссылку на Google таблицу");
      return;
    }
    const msgGFinish =
      "Загрузить результаты из этой Google Таблицы и завершить турнир?";
    const msgGReplace =
      "Все текущие результаты турнира будут удалены и записаны заново из Google Таблицы. Продолжить?";
    if (
      !window.confirm(
        variant === "complete-in-progress" ? msgGFinish : msgGReplace
      )
    ) {
      return;
    }
    if (variant === "replace-finished") {
      replaceFinishedGoogleMutation.mutate({ tournamentId: tid, url });
    } else {
      completeGoogleMutation.mutate({ tournamentId: tid, url });
    }
  };

  if (!open) return null;
  if (
    variant !== "new-tournament" &&
    (!tournament || !Number.isFinite(tournament.id) || tournament.id <= 0)
  ) {
    return null;
  }

  const modalTitle =
    variant === "new-tournament"
      ? "Загрузить турнир"
      : variant === "replace-finished"
        ? "Заменить результаты турнира"
        : "Загрузить результаты и завершить турнир";

  const showMeta = variant !== "new-tournament" && tournament;

  return (
    <div className="fixed inset-0 z-50 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
      <div className="card max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900">{modalTitle}</h2>
          <button
            type="button"
            onClick={() => !existingBusy && !uploadNewMutation.isLoading && onClose()}
            className="text-gray-400 hover:text-gray-600"
            disabled={existingBusy || uploadNewMutation.isLoading}
          >
            ✕
          </button>
        </div>

        {showMeta && (
          <>
            <p className="text-sm text-gray-600 mb-4">
              {variant === "replace-finished"
                ? "Все текущие результаты будут удалены и записаны заново. В файле или таблице название, дата, тип и категория должны совпадать с карточкой турнира."
                : "После загрузки турнир перейдёт в статус «Завершён». Дата, тип и категория в источнике должны совпадать с карточкой турнира."}
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm border border-gray-100 rounded-lg p-4 mb-4 bg-gray-50">
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Название</dt>
                <dd className="font-medium text-gray-900">{tournament.name}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Дата</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(tournament.date)}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Категория</dt>
                <dd className="font-medium text-gray-900">
                  {getTornamentCategoryText(
                    tournament.category as TournamentCategory
                  )}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-gray-500">Тип</dt>
                <dd className="font-medium text-gray-900 flex items-center flex-wrap gap-1">
                  {getTournamentTypeText(tournament.type)}
                  {getTournamentTypeIcons(tournament.type)}
                </dd>
              </div>
            </dl>
          </>
        )}

        {variant === "new-tournament" ? (
          <form
            onSubmit={handleSubmit(handleNewSubmit)}
            className="space-y-4"
          >
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
                Тип турнира
              </label>
              <select
                className={`input-field ${
                  errors.tournament_type ? "border-red-300" : ""
                }`}
                {...register("tournament_type", {
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
              {errors.tournament_type && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.tournament_type.message}
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
                      setUploadMode(e.target.value as "file" | "google-sheets")
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
                      setUploadMode(e.target.value as "file" | "google-sheets")
                    }
                    className="mr-2"
                  />
                  🔗 Google Таблица
                </label>
              </div>
            </div>

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
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        setValue("tournament_file", files);
                        setFileError("");
                        setCriticalErrors([]);
                      }
                    }}
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
                <CriticalErrorsPanel
                  criticalErrors={criticalErrors}
                  criticalErrorsHeader={criticalErrorsHeader}
                />
              </div>
            )}

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
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Убедитесь, что таблица открыта для просмотра всем, у кого
                    есть ссылка
                  </p>
                </div>
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
                {googleSheetsCheck.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <span className="text-sm text-red-800">
                      ❌ {googleSheetsCheck.error}
                    </span>
                  </div>
                )}
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
                {criticalErrors.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg">
                    <h4 className="text-sm font-semibold text-red-900 mb-2 flex items-center">
                      <span className="mr-2">⚠️</span>
                      {criticalErrorsHeader || "Критические ошибки в файле:"}
                      <span className="ml-auto bg-red-200 text-red-900 px-2 py-1 rounded text-xs">
                        {criticalErrors.length} ошибок
                      </span>
                    </h4>
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
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={uploadNewMutation.isLoading}
              >
                Отмена
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={uploadNewMutation.isLoading}
              >
                {uploadNewMutation.isLoading ? "Загрузка..." : "Загрузить"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Способ загрузки данных
              </label>
              <div className="flex space-x-4 mb-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="file"
                    checked={uploadMode === "file"}
                    onChange={(e) =>
                      setUploadMode(e.target.value as "file" | "google-sheets")
                    }
                    className="mr-2"
                    disabled={existingBusy}
                  />
                  📄 Excel файл
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="google-sheets"
                    checked={uploadMode === "google-sheets"}
                    onChange={(e) =>
                      setUploadMode(e.target.value as "file" | "google-sheets")
                    }
                    className="mr-2"
                    disabled={existingBusy}
                  />
                  🔗 Google Таблица
                </label>
              </div>
            </div>

            {uploadMode === "file" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Файл Excel с результатами
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleExistingFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={existingBusy}
                  className="w-full flex items-center justify-center px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors disabled:opacity-50"
                >
                  <DocumentArrowUpIcon className="h-6 w-6 text-gray-400 mr-3" />
                  <div className="text-center">
                    <span className="text-gray-600">
                      {existingSelectedFile && existingSelectedFile.length > 0
                        ? existingSelectedFile[0].name
                        : "Нажмите для выбора файла"}
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Поддерживаются файлы .xlsx, .xls
                    </p>
                  </div>
                </button>
                {fileError && (
                  <p className="mt-1 text-sm text-red-600">{fileError}</p>
                )}
              </div>
            )}

            {uploadMode === "google-sheets" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ссылка на Google Таблицу
                </label>
                <input
                  type="url"
                  className="input-field"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={existingGoogleUrl}
                  disabled={existingBusy}
                  onChange={(e) => {
                    setExistingGoogleUrl(e.target.value);
                    setGoogleSheetsCheck({
                      loading: false,
                      result: null,
                      error: "",
                    });
                  }}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={existingBusy || !existingGoogleUrl.trim()}
                    onClick={() => void checkGoogleSheetsUrl(existingGoogleUrl)}
                  >
                    Проверить доступ
                  </button>
                </div>
                {googleSheetsCheck.loading && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 flex items-center gap-2">
                    <div className="loading-spinner shrink-0" />
                    Проверяем доступность таблицы…
                  </div>
                )}
                {googleSheetsCheck.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    {googleSheetsCheck.error}
                  </div>
                )}
                {googleSheetsCheck.result && !googleSheetsCheck.error && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                    <p className="font-medium">Таблица доступна для чтения</p>
                    <p className="text-xs mt-1">
                      Листов: {googleSheetsCheck.result.totalSheets}.{" "}
                      {googleSheetsCheck.result.sheetNames.join(", ")}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
                disabled={existingBusy}
              >
                Отмена
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={existingBusy}
                onClick={() => submitExisting()}
              >
                {existingBusy
                  ? "Загрузка..."
                  : variant === "complete-in-progress"
                    ? "Загрузить и завершить"
                    : "Заменить результаты"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentResultsUploadModal;
