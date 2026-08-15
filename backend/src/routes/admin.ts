import { Router } from "express";
import {
  AdminController,
  licensedPlayersUploadMiddleware,
  playersTextUploadMiddleware,
  registrationCsvUploadMiddleware,
  uploadMiddleware,
} from "../controllers/AdminController";
import { SettingsController } from "../controllers/SettingsController";
import { TournamentController } from "../controllers/TournamentController";
import { UserController } from "../controllers/UserController";
import { AdminAuditController } from "../controllers/AdminAuditController";
import {
  authenticateAdmin,
  requireAdmin,
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  requireTournamentViewer,
  requirePresidiumOrAdmin,
  requirePlayersSectionAccess,
  requireLicensedPlayersEditor,
} from "../middleware/auth";
import { auditLog, auditLogDelete } from "../middleware/audit";

const router = Router();

// === ТЕСТИРОВАНИЕ И ДИАГНОСТИКА (БЕЗ АУТЕНТИФИКАЦИИ) ===
// GET /api/admin/test-google-sheets-api - тестирование Google Sheets API ключа
router.get(
  "/test-google-sheets-api",
  TournamentController.testGoogleSheetsApiKey,
);

// GET /api/admin/settings/best-results-count - получить количество лучших результатов (публичный доступ)
router.get(
  "/settings/best-results-count",
  SettingsController.getBestResultsCount,
);

// Применяем middleware авторизации ко всем остальным админским роутам
router.use(authenticateAdmin);

// === УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (только ADMIN) ===
// GET /api/admin/users - получить всех пользователей
router.get("/users", requireAdmin, UserController.getAllUsers);

// GET /api/admin/users/current - получить текущего пользователя
router.get("/users/current", UserController.getCurrentUser);

// POST /api/admin/users - создать пользователя
router.post(
  "/users",
  requireAdmin,
  auditLog({
    action: "CREATE_USER",
    entityType: "user",
    getEntityName: (req) => req.body.username || null,
    getDescription: (req) =>
      `Создание пользователя ${req.body.name || req.body.username}`,
  }),
  UserController.createUser,
);

// PUT /api/admin/users/:userId - обновить пользователя
router.put(
  "/users/:userId",
  requireAdmin,
  auditLog({
    action: "UPDATE_USER",
    entityType: "user",
    getEntityId: (req) => parseInt(req.params.userId),
    getEntityName: (req) => req.body.username || null,
    getDescription: (req) => `Обновление пользователя ID ${req.params.userId}`,
  }),
  UserController.updateUser,
);

// DELETE /api/admin/users/:userId - удалить пользователя
router.delete(
  "/users/:userId",
  requireAdmin,
  auditLogDelete({
    action: "DELETE_USER",
    entityType: "user",
    getEntityId: (req) => parseInt(req.params.userId),
    getDescription: (req, entityName) =>
      `Удаление пользователя ${entityName || "ID " + req.params.userId}`,
  }),
  UserController.deleteUser,
);

// === УПРАВЛЕНИЕ ТУРНИРАМИ ===
// Доступно для ADMIN и MANAGER
// POST /api/admin/tournaments/upload - загрузка турнира из Excel
router.post(
  "/tournaments/upload",
  requireTournamentStaff,
  uploadMiddleware,
  auditLog({
    action: "UPLOAD_TOURNAMENT",
    entityType: "tournament",
    getEntityName: (req) => req.body.tournament_name || null,
    getDescription: (req) =>
      `Загрузка турнира "${
        req.body.tournament_name || "без названия"
      }" из файла`,
  }),
  AdminController.uploadTournament,
);

// POST /api/admin/tournaments/upload-from-google-sheets - загрузка турнира из Google Sheets
router.post(
  "/tournaments/upload-from-google-sheets",
  requireTournamentStaff,
  auditLog({
    action: "UPLOAD_TOURNAMENT",
    entityType: "tournament",
    getEntityName: (req) => req.body.tournament_name || null,
    getDescription: (req) =>
      `Загрузка турнира из Google Sheets: ${req.body.tournament_name}`,
  }),
  AdminController.uploadTournamentFromGoogleSheets,
);

// POST /api/admin/tournaments/check-google-sheets - проверка доступности Google таблицы
router.post(
  "/tournaments/check-google-sheets",
  requireTournamentStaff,
  TournamentController.checkGoogleSheetsAccess,
);

// GET /api/admin/tournaments - получить все турниры
router.get(
  "/tournaments",
  requireTournamentViewer,
  AdminController.getTournaments,
);

// POST /api/admin/tournaments - создать турнир без загрузки результатов (ADMIN и MANAGER)
router.post(
  "/tournaments",
  requireTournamentStaff,
  auditLog({
    action: "CREATE_TOURNAMENT",
    entityType: "tournament",
    getEntityName: (req) => req.body.name || null,
    getDescription: (req) =>
      `Создание турнира "${req.body.name || "без названия"}"`,
  }),
  AdminController.createTournament,
);

// GET /api/admin/tournaments/:tournamentId/draft — черновик (параметры без заявок)
router.get(
  "/tournaments/:tournamentId/draft",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  AdminController.getTournamentDraftPage,
);

// GET /api/admin/tournaments/:tournamentId/registration — страница регистрации (до :tournamentId одиночного)
router.get(
  "/tournaments/:tournamentId/registration",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  AdminController.getTournamentRegistrationPage,
);

// GET /api/admin/tournaments/:tournamentId/in-progress — снимок заявок (статус «В процессе»)
router.get(
  "/tournaments/:tournamentId/in-progress",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  AdminController.getTournamentInProgressPage,
);

// GET /api/admin/tournaments/:tournamentId/finished — завершённый турнир
router.get(
  "/tournaments/:tournamentId/finished",
  requireTournamentViewer,
  AdminController.getTournamentFinishedPage,
);

// PUT /api/admin/tournaments/:tournamentId/group-matches/:matchId — счёт матча группы
router.put(
  "/tournaments/:tournamentId/group-matches/:matchId",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "UPDATE_TOURNAMENT_GROUP_MATCH",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Обновление матча #${req.params.matchId} турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.updateTournamentGroupMatch,
);

// PUT /api/admin/tournaments/:tournamentId/swiss-matches/:matchId — счёт матча швейцарки
router.put(
  "/tournaments/:tournamentId/swiss-matches/:matchId",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "UPDATE_TOURNAMENT_SWISS_MATCH",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Обновление матча швейцарки #${req.params.matchId} турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.updateTournamentSwissMatch,
);

// DELETE /api/admin/tournaments/:tournamentId/swiss/rounds/:roundNumber
// — удалить тур и последующие (откат к предыдущему)
router.delete(
  "/tournaments/:tournamentId/swiss/rounds/:roundNumber",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "ROLLBACK_TOURNAMENT_SWISS_ROUND",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Откат швейцарки с тура ${req.params.roundNumber} турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.rollbackSwissRound,
);

// POST /api/admin/tournaments/:tournamentId/swiss/rounds/:roundNumber/advance
// — сформировать следующий тур по итогам указанного
router.post(
  "/tournaments/:tournamentId/swiss/rounds/:roundNumber/advance",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "ADVANCE_TOURNAMENT_SWISS_ROUND",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Переход к следующему туру после тура ${req.params.roundNumber} турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.advanceSwissRound,
);

// POST /api/admin/tournaments/:tournamentId/swiss/teams/:teamId/withdraw
router.post(
  "/tournaments/:tournamentId/swiss/teams/:teamId/withdraw",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "WITHDRAW_TOURNAMENT_SWISS_TEAM",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Снятие команды ${req.params.teamId} со швейцарки турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.withdrawSwissTeam,
);

// DELETE /api/admin/tournaments/:tournamentId/swiss/teams/:teamId/withdraw
router.delete(
  "/tournaments/:tournamentId/swiss/teams/:teamId/withdraw",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "REINSTATE_TOURNAMENT_SWISS_TEAM",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Возврат команды ${req.params.teamId} в швейцарку турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.reinstateSwissTeam,
);

// POST /api/admin/tournaments/:tournamentId/cup-stage/start
router.post(
  "/tournaments/:tournamentId/cup-stage/start",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "START_CUP_STAGE",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Старт финала турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.startCupStage,
);

// DELETE /api/admin/tournaments/:tournamentId/cup-stage
router.delete(
  "/tournaments/:tournamentId/cup-stage",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "RESET_CUP_STAGE",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Сброс финала турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.resetCupStage,
);

// POST /api/admin/tournaments/:tournamentId/cup-stage/finish
router.post(
  "/tournaments/:tournamentId/cup-stage/finish",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "FINISH_TOURNAMENT_FROM_CUPS",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Завершение турнира ID ${req.params.tournamentId} по итогам кубков`,
  }),
  AdminController.finishTournamentFromCupStage,
);

// PUT /api/admin/tournaments/:tournamentId/cup-matches/:matchId
router.put(
  "/tournaments/:tournamentId/cup-matches/:matchId",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "UPDATE_TOURNAMENT_CUP_MATCH",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Обновление матча кубка #${req.params.matchId} турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.updateTournamentCupMatch,
);

// POST /api/admin/tournaments/:tournamentId/complete-from-excel — завершить турнир «в процессе» загрузкой Excel
router.post(
  "/tournaments/:tournamentId/complete-from-excel",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  uploadMiddleware,
  auditLog({
    action: "UPLOAD_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Завершение турнира ID ${req.params.tournamentId} загрузкой результатов из файла`,
  }),
  AdminController.completeInProgressTournamentFromExcel,
);

// POST /api/admin/tournaments/:tournamentId/complete-from-google-sheets — завершить «в процессе» из Google Таблицы
router.post(
  "/tournaments/:tournamentId/complete-from-google-sheets",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "UPLOAD_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Завершение турнира ID ${req.params.tournamentId} загрузкой результатов из Google Sheets`,
  }),
  AdminController.completeInProgressTournamentFromGoogleSheets,
);

// POST /api/admin/tournaments/:tournamentId/replace-results-from-excel — полностью заменить результаты завершённого турнира
router.post(
  "/tournaments/:tournamentId/replace-results-from-excel",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  uploadMiddleware,
  auditLog({
    action: "UPLOAD_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Замена результатов завершённого турнира ID ${req.params.tournamentId} из файла`,
  }),
  AdminController.replaceFinishedTournamentResultsFromExcel,
);

// POST /api/admin/tournaments/:tournamentId/replace-results-from-google-sheets — заменить результаты завершённого турнира из Google
router.post(
  "/tournaments/:tournamentId/replace-results-from-google-sheets",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "UPLOAD_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Замена результатов завершённого турнира ID ${req.params.tournamentId} из Google Sheets`,
  }),
  AdminController.replaceFinishedTournamentResultsFromGoogleSheets,
);

// POST /api/admin/tournaments/:tournamentId/registration — зарегистрировать команду на турнир
router.post(
  "/tournaments/:tournamentId/registration",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "REGISTER_TOURNAMENT_TEAM",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Регистрация команды на турнир ID ${req.params.tournamentId}`,
  }),
  AdminController.registerTournamentTeam,
);

// POST /api/admin/tournaments/:tournamentId/registration/import-csv — импорт команд из CSV
router.post(
  "/tournaments/:tournamentId/registration/import-csv",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  registrationCsvUploadMiddleware,
  auditLog({
    action: "IMPORT_TOURNAMENT_REGISTRATIONS_CSV",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Импорт заявок из CSV на турнир ID ${req.params.tournamentId}`,
  }),
  AdminController.importTournamentRegistrationsFromCsv,
);

// POST /api/admin/tournaments/:tournamentId/registration/:teamId/confirm — подтвердить заявку команды
router.post(
  "/tournaments/:tournamentId/registration/:teamId/confirm",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "CONFIRM_TOURNAMENT_REGISTRATION",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Подтверждение заявки команды #${req.params.teamId} на турнир ID ${req.params.tournamentId}`,
  }),
  AdminController.confirmTournamentRegistration,
);

// PUT /api/admin/tournaments/:tournamentId/registration/:teamId - изменить состав зарегистрированной команды
router.put(
  "/tournaments/:tournamentId/registration/:teamId",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  AdminController.updateTournamentRegistrationTeam,
);

// DELETE /api/admin/tournaments/:tournamentId/registration/:teamId - удалить заявку команды
router.delete(
  "/tournaments/:tournamentId/registration/:teamId",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "DELETE_TOURNAMENT_REGISTRATION",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Удаление заявки команды #${req.params.teamId} с турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.deleteTournamentRegistration,
);

// GET /api/admin/tournaments/:tournamentId - получить турнир с результатами
router.get(
  "/tournaments/:tournamentId",
  requireTournamentViewer,
  AdminController.getTournamentDetails,
);

// POST /api/admin/tournaments/:tournamentId/validate-results — признать результаты для рейтинга
router.post(
  "/tournaments/:tournamentId/validate-results",
  requirePresidiumOrAdmin,
  auditLog({
    action: "VALIDATE_TOURNAMENT_RESULTS",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Признание результатов турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.validateTournamentResults,
);

// PUT /api/admin/tournaments/:tournamentId/play-settings — формат и параметры проведения
router.put(
  "/tournaments/:tournamentId/play-settings",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "UPDATE_TOURNAMENT_PLAY_SETTINGS",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Настройка проведения турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.updateTournamentPlaySettings,
);

// POST /api/admin/tournaments/:tournamentId/group-draw — автоматическая жеребьёвка по группам
router.post(
  "/tournaments/:tournamentId/group-draw",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "TOURNAMENT_GROUP_DRAW",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Жеребьёвка по группам для турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.performTournamentGroupDraw,
);

// PUT /api/admin/tournaments/:tournamentId/group-draw — ручная жеребьёвка по группам
router.put(
  "/tournaments/:tournamentId/group-draw",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "TOURNAMENT_GROUP_DRAW_MANUAL",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Ручная жеребьёвка по группам для турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.saveManualTournamentGroupDraw,
);

// POST /api/admin/tournaments/:tournamentId/start — в финальную регистрацию (до выбора формата)
router.post(
  "/tournaments/:tournamentId/start",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "START_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) => `Старт турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.startTournament,
);

// POST /api/admin/tournaments/:tournamentId/begin-play — формат выбран, переход к IN_PROGRESS
router.post(
  "/tournaments/:tournamentId/begin-play",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "BEGIN_TOURNAMENT_PLAY",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Переход к проведению турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.beginTournamentPlay,
);

// PUT /api/admin/tournaments/:tournamentId - обновить турнир (ADMIN и MANAGER)
router.put(
  "/tournaments/:tournamentId",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  auditLog({
    action: "UPDATE_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId),
    // entity_name будет получено автоматически из БД через getEntityNameFromDB
    getDescription: (req) => `Обновление турнира ID ${req.params.tournamentId}`,
  }),
  AdminController.updateTournament,
);

// PUT /api/admin/tournaments/:tournamentId/organizer — сменить организатора (только ADMIN)
router.put(
  "/tournaments/:tournamentId/organizer",
  requireAdmin,
  auditLog({
    action: "SET_TOURNAMENT_ORGANIZER",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId, 10),
    getDescription: (req) =>
      `Смена организатора турнира ID ${req.params.tournamentId} → user ${req.body?.organizer_user_id}`,
  }),
  AdminController.setTournamentOrganizer,
);

// DELETE /api/admin/tournaments/:tournamentId - удалить турнир (только ADMIN)
router.delete(
  "/tournaments/:tournamentId",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  requireAdmin,
  auditLogDelete({
    action: "DELETE_TOURNAMENT",
    entityType: "tournament",
    getEntityId: (req) => parseInt(req.params.tournamentId),
    getDescription: (req, entityName) =>
      `Удаление турнира "${entityName || "ID " + req.params.tournamentId}"`,
  }),
  AdminController.deleteTournament,
);

// DELETE /api/admin/tournaments/results/:resultId - удалить результат (турнир/кубок) (только ADMIN)
router.delete(
  "/tournaments/results/:resultId",
  requireTournamentStaff,
  requireAdmin,
  auditLogDelete({
    action: "DELETE_TOURNAMENT",
    entityType: "tournament_result",
    getEntityId: (req) => parseInt(req.params.resultId),
    getDescription: (req, entityName) =>
      `Удаление результата турнира "${
        entityName || "ID " + req.params.resultId
      }"`,
  }),
  TournamentController.deleteTournamentResult,
);

// === УПРАВЛЕНИЕ ИГРОКАМИ ===
// Доступно для ADMIN, MANAGER и LICENSE_MANAGER
// GET /api/admin/players - получить всех игроков
router.get(
  "/players",
  requirePlayersSectionAccess,
  AdminController.getPlayers,
);

// POST /api/admin/players - создать игрока
router.post(
  "/players",
  requirePlayersSectionAccess,
  auditLog({
    action: "CREATE_PLAYER",
    entityType: "player",
    getEntityName: (req) => req.body.name || null,
    getDescription: (req) => `Создание игрока ${req.body.name}`,
  }),
  AdminController.createPlayer,
);

// POST /api/admin/players/upload-text - массовая загрузка игроков из текстового файла
router.post(
  "/players/upload-text",
  requirePlayersSectionAccess,
  playersTextUploadMiddleware,
  auditLog({
    action: "CREATE_PLAYER",
    entityType: "player",
    getDescription: (req) => `Массовая загрузка игроков из файла`,
  }),
  AdminController.uploadPlayersFromText,
);

// PUT /api/admin/players/:playerId - обновить игрока
router.put(
  "/players/:playerId",
  requirePlayersSectionAccess,
  auditLog({
    action: "UPDATE_PLAYER",
    entityType: "player",
    getEntityId: (req) => parseInt(req.params.playerId),
    getEntityName: (req) => req.body.name || null,
    getDescription: (req) => `Обновление игрока ID ${req.params.playerId}`,
  }),
  AdminController.updatePlayer,
);

// DELETE /api/admin/players/:playerId - удалить игрока (ADMIN и MANAGER, если игрок не участвовал в турнирах)
router.delete(
  "/players/:playerId",
  requirePlayersSectionAccess,
  auditLogDelete({
    action: "DELETE_PLAYER",
    entityType: "player",
    getEntityId: (req) => parseInt(req.params.playerId),
    getDescription: (req, entityName) =>
      `Удаление игрока ${entityName || "ID " + req.params.playerId}`,
  }),
  AdminController.deletePlayer,
);

// === НАСТРОЙКИ РЕЙТИНГА (только для ADMIN) ===

// PUT /api/admin/settings/best-results-count - обновить количество лучших результатов
router.put(
  "/settings/best-results-count",
  requireAdmin,
  auditLog({
    action: "UPDATE_SETTINGS",
    entityType: "settings",
    getDescription: (req) =>
      `Изменение количества лучших результатов: ${req.body.count}`,
  }),
  SettingsController.setBestResultsCount,
);

// GET /api/admin/settings - получить все настройки
router.get("/settings", requireAdmin, SettingsController.getAllSettings);

// === УПРАВЛЕНИЕ ЛИЦЕНЗИОННЫМИ ИГРОКАМИ ===
// Только ADMIN и LICENSE_MANAGER (организатор турнира раздел не видит)
// GET /api/admin/licensed-players - получить всех лицензионных игроков
router.get(
  "/licensed-players",
  requireLicensedPlayersEditor,
  AdminController.getLicensedPlayers,
);

// GET /api/admin/licensed-players/active - получить активных лицензионных игроков
router.get(
  "/licensed-players/active",
  requireLicensedPlayersEditor,
  AdminController.getActiveLicensedPlayers,
);

// GET /api/admin/licensed-players/years - получить доступные годы
router.get(
  "/licensed-players/years",
  requireLicensedPlayersEditor,
  AdminController.getLicensedPlayersYears,
);

// GET /api/admin/licensed-players/statistics - получить статистику
router.get(
  "/licensed-players/statistics",
  requireLicensedPlayersEditor,
  AdminController.getLicensedPlayersStatistics,
);

// POST /api/admin/licensed-players - создать лицензионного игрока
router.post(
  "/licensed-players",
  requireLicensedPlayersEditor,
  auditLog({
    action: "CREATE_PLAYER",
    entityType: "licensed_player",
    getEntityName: (req) => req.body.player_name || null,
    getDescription: (req) =>
      `Создание лицензионного игрока ${req.body.player_name}`,
  }),
  AdminController.createLicensedPlayer,
);

// PUT /api/admin/licensed-players/:playerId - обновить лицензионного игрока
router.put(
  "/licensed-players/:playerId",
  requireLicensedPlayersEditor,
  auditLog({
    action: "UPDATE_PLAYER",
    entityType: "licensed_player",
    getEntityId: (req) => parseInt(req.params.playerId),
    getDescription: (req) =>
      `Обновление лицензионного игрока ID ${req.params.playerId}`,
  }),
  AdminController.updateLicensedPlayer,
);

// DELETE /api/admin/licensed-players/:playerId - удалить лицензионного игрока
router.delete(
  "/licensed-players/:playerId",
  requireLicensedPlayersEditor,
  auditLogDelete({
    action: "DELETE_PLAYER",
    entityType: "licensed_player",
    getEntityId: (req) => parseInt(req.params.playerId),
    getDescription: (req, entityName) =>
      `Удаление лицензионного игрока ${
        entityName || "ID " + req.params.playerId
      }`,
  }),
  AdminController.deleteLicensedPlayer,
);

// POST /api/admin/licensed-players/upload - загрузка списка из Excel файла
router.post(
  "/licensed-players/upload",
  requireLicensedPlayersEditor,
  licensedPlayersUploadMiddleware,
  auditLog({
    action: "UPLOAD_LICENSED_PLAYERS",
    entityType: "licensed_player",
    getDescription: (req) => `Загрузка лицензионных игроков из файла`,
  }),
  AdminController.uploadLicensedPlayers,
);

// === ПЕРЕСЧЁТ РЕЙТИНГА ===
// POST /api/admin/tournaments/recalculate-points - пересчитать очки всех турниров текущего календарного года (только ADMIN)
router.post(
  "/tournaments/recalculate-points",
  requireAdmin,
  AdminController.recalculateTournamentPoints,
);

// POST /api/admin/tournaments/:tournamentId/recalculate-points - пересчитать очки конкретного турнира
router.post(
  "/tournaments/:tournamentId/recalculate-points",
  requireTournamentStaff,
  requireTournamentOrganizerOrAdmin,
  async (req, res) => {
    try {
      const tournamentId = parseInt(req.params.tournamentId);
      if (isNaN(tournamentId)) {
        res.status(400).json({
          success: false,
          message: "Неверный ID турнира",
        });
        return;
      }

      const { TournamentModel } = await import("../models/TournamentModel");
      await TournamentModel.recalculateTournamentPoints(tournamentId);

      res.json({
        success: true,
        message: `Очки турнира ${tournamentId} успешно пересчитаны`,
      });
    } catch (error) {
      console.error("Ошибка пересчёта очков турнира:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка пересчёта очков: " + (error as Error).message,
      });
    }
  },
);

// === ЛОГИ АУДИТА (только для ADMIN) ===
// GET /api/admin/audit-logs - получить логи аудита с фильтрацией
router.get("/audit-logs", requireAdmin, AdminAuditController.getAuditLogs);

// GET /api/admin/audit-logs/statistics - получить статистику по действиям
router.get(
  "/audit-logs/statistics",
  requireAdmin,
  AdminAuditController.getStatistics,
);

// GET /api/admin/audit-logs/actions - получить список доступных действий
router.get(
  "/audit-logs/actions",
  requireAdmin,
  AdminAuditController.getAvailableActions,
);

// GET /api/admin/audit-logs/entity-types - получить список типов сущностей
router.get(
  "/audit-logs/entity-types",
  requireAdmin,
  AdminAuditController.getEntityTypes,
);

// GET /api/admin/audit-logs/user/:userId - получить историю действий пользователя
router.get(
  "/audit-logs/user/:userId",
  requireAdmin,
  AdminAuditController.getUserAuditHistory,
);

// GET /api/admin/audit-logs/entity/:entityType/:entityId - получить историю изменений сущности
router.get(
  "/audit-logs/entity/:entityType/:entityId",
  requireAdmin,
  AdminAuditController.getEntityAuditHistory,
);

// GET /api/admin/audit-logs/:id - получить конкретную запись аудита
router.get(
  "/audit-logs/:id",
  requireAdmin,
  AdminAuditController.getAuditLogById,
);

// DELETE /api/admin/audit-logs/cleanup - удалить старые записи
router.delete(
  "/audit-logs/cleanup",
  requireAdmin,
  AdminAuditController.cleanup,
);

export default router;
