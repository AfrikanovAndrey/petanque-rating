import { Request, Response } from "express";
import { TournamentModel } from "../models/TournamentModel";
import { TournamentRegistrationModel } from "../models/TournamentRegistrationModel";
import { TournamentSwissModel } from "../models/TournamentSwissModel";
import {
  getDefaultTiebreakerOrder,
  validatePlaySettings,
  type TournamentPlaySettingsInput,
} from "../services/tournamentPlaySettings";
import {
  TiebreakerCriterion,
  TournamentPlayFormat,
  TournamentStatus,
  TournamentType,
} from "../types";

export class TournamentSwissController {
  private static async loadSwissPageData(
    tournamentId: number,
    options?: { confirmedTeamsOnly?: boolean },
  ) {
    const tournament = await TournamentModel.getTournamentById(tournamentId);
    if (!tournament) {
      return { error: { status: 404, message: "Турнир не найден" } };
    }
    if (tournament.status !== TournamentStatus.IN_PROGRESS) {
      return {
        error: {
          status: 400,
          message:
            "Швейцарская система доступна только для турниров «В процессе»",
        },
      };
    }

    const teams =
      await TournamentRegistrationModel.listRegisteredTeamsWithPlayers(
        tournamentId,
        tournament.type as TournamentType,
        options?.confirmedTeamsOnly ? { confirmedOnly: true } : undefined,
      );

    if (tournament.play_format !== TournamentPlayFormat.SWISS) {
      return {
        data: {
          tournament,
          teams,
          rounds: [],
          matches: [],
          standings: [],
          initialized: false,
        },
      };
    }

    const initialized = await TournamentSwissModel.isInitialized(tournamentId);
    if (initialized) {
      await TournamentSwissModel.refreshStandings(tournamentId);
    }

    const [rounds, matches, standings] = await Promise.all([
      TournamentSwissModel.getRounds(tournamentId),
      TournamentSwissModel.getMatches(tournamentId),
      TournamentSwissModel.getStandings(tournamentId),
    ]);

    return {
      data: {
        tournament,
        teams,
        rounds,
        matches,
        standings,
        initialized,
      },
    };
  }

  private static async assertSwissTournament(tournamentId: number) {
    const tournament = await TournamentModel.getTournamentById(tournamentId);
    if (!tournament) {
      return { error: { status: 404, message: "Турнир не найден" } };
    }
    if (tournament.status !== TournamentStatus.IN_PROGRESS) {
      return {
        error: {
          status: 400,
          message:
            "Швейцарская система доступна только для турниров «В процессе»",
        },
      };
    }
    if (tournament.play_format !== TournamentPlayFormat.SWISS) {
      return {
        error: {
          status: 400,
          message: "Турнир не настроен на швейцарскую систему",
        },
      };
    }
    return { tournament };
  }

  static async getSwissPage(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({ success: false, message: "Неверный ID турнира" });
        return;
      }

      const result = await TournamentSwissController.loadSwissPageData(
        tournamentId,
      );
      if ("error" in result && result.error) {
        res
          .status(result.error.status)
          .json({ success: false, message: result.error.message });
        return;
      }

      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error("Ошибка загрузки шvейцарки:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка загрузки данных швейцарской системы",
      });
    }
  }

  static async getPublicSwissPage(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.id, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({ success: false, message: "Неверный ID турнира" });
        return;
      }

      const result = await TournamentSwissController.loadSwissPageData(
        tournamentId,
        { confirmedTeamsOnly: true },
      );
      if ("error" in result && result.error) {
        res
          .status(result.error.status)
          .json({ success: false, message: result.error.message });
        return;
      }

      res.json({ success: true, data: result.data });
    } catch (error) {
      console.error("Ошибка публичной загрузки швейцарки:", error);
      res.status(500).json({
        success: false,
        message: "Ошибка загрузки данных швейцарской системы",
      });
    }
  }

  static async updatePlaySettings(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({ success: false, message: "Неверный ID турнира" });
        return;
      }

      const tournament = await TournamentModel.getTournamentById(tournamentId);
      if (!tournament) {
        res.status(404).json({ success: false, message: "Турнир не найден" });
        return;
      }

      if (
        tournament.status !== TournamentStatus.REGISTRATION &&
        tournament.status !== TournamentStatus.IN_PROGRESS
      ) {
        res.status(400).json({
          success: false,
          message:
            "Настройки проведения можно менять только до завершения турнира",
        });
        return;
      }

      const initialized = await TournamentSwissModel.isInitialized(tournamentId);
      if (initialized) {
        res.status(400).json({
          success: false,
          message: "Нельзя менять настройки после начала швейцарки",
        });
        return;
      }

      const { play_format, swiss_rounds, tiebreaker_order } = req.body;
      const settingsInput: TournamentPlaySettingsInput = {
        play_format: play_format as TournamentPlayFormat,
        swiss_rounds:
          swiss_rounds === undefined || swiss_rounds === null
            ? null
            : Number(swiss_rounds),
        tiebreaker_order: Array.isArray(tiebreaker_order)
          ? (tiebreaker_order as TiebreakerCriterion[])
          : [],
      };

      const validationError = validatePlaySettings(settingsInput);
      if (validationError) {
        res.status(400).json({ success: false, message: validationError });
        return;
      }

      const success = await TournamentModel.updateTournamentPlaySettings(
        tournamentId,
        settingsInput.play_format,
        null,
        settingsInput.swiss_rounds ?? null,
        settingsInput.tiebreaker_order ?? [],
      );

      if (!success) {
        res.status(400).json({
          success: false,
          message: "Не удалось сохранить настройки",
        });
        return;
      }

      const updated = await TournamentModel.getTournamentById(tournamentId);
      res.json({
        success: true,
        message: "Настройки сохранены",
        data: updated,
      });
    } catch (error) {
      console.error("Ошибка сохранения настроек швейцарки:", error);
      res.status(500).json({
        success: false,
        message: "Внутренняя ошибка сервера",
      });
    }
  }

  static async initializeSwiss(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      if (isNaN(tournamentId)) {
        res.status(400).json({ success: false, message: "Неверный ID турнира" });
        return;
      }

      const check = await TournamentSwissController.assertSwissTournament(
        tournamentId,
      );
      if ("error" in check && check.error) {
        res
          .status(check.error.status)
          .json({ success: false, message: check.error.message });
        return;
      }

      const { tournament } = check;
      if (!tournament!.swiss_rounds || tournament!.swiss_rounds < 1) {
        res.status(400).json({
          success: false,
          message: "Укажите количество туров швейцарской системы",
        });
        return;
      }

      const teamIds = await TournamentSwissModel.getConfirmedTeamIds(
        tournamentId,
      );
      if (teamIds.length < 2) {
        res.status(400).json({
          success: false,
          message: "Нужно минимум 2 подтверждённые команды",
        });
        return;
      }

      await TournamentSwissModel.initializeSwiss(
        tournamentId,
        teamIds,
        tournament!.swiss_rounds,
      );

      res.json({
        success: true,
        message: "Швейцарская система инициализирована, первый тур создан",
      });
    } catch (error) {
      console.error("Ошибка инициализации швейцарки:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Не удалось инициализировать швейцарскую систему",
      });
    }
  }

  static async updateMatchResult(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const matchId = parseInt(req.params.matchId, 10);
      if (isNaN(tournamentId) || isNaN(matchId)) {
        res.status(400).json({ success: false, message: "Неверный ID" });
        return;
      }

      const check = await TournamentSwissController.assertSwissTournament(
        tournamentId,
      );
      if ("error" in check && check.error) {
        res
          .status(check.error.status)
          .json({ success: false, message: check.error.message });
        return;
      }

      const { score_a, score_b } = req.body;
      if (
        typeof score_a !== "number" ||
        typeof score_b !== "number" ||
        !Number.isInteger(score_a) ||
        !Number.isInteger(score_b)
      ) {
        res.status(400).json({
          success: false,
          message: "Укажите целочисленный счёт обеих команд",
        });
        return;
      }

      const match = await TournamentSwissModel.recordMatchResult(
        matchId,
        score_a,
        score_b,
      );

      if (match.tournament_id !== tournamentId) {
        res.status(400).json({ success: false, message: "Матч не принадлежит турниру" });
        return;
      }

      const standings = await TournamentSwissModel.getStandings(tournamentId);

      res.json({
        success: true,
        message: "Результат матча сохранён",
        data: { match, standings },
      });
    } catch (error) {
      console.error("Ошибка сохранения результата матча:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Не удалось сохранить результат",
      });
    }
  }

  static async completeRound(req: Request, res: Response): Promise<void> {
    try {
      const tournamentId = parseInt(req.params.tournamentId, 10);
      const roundNumber = parseInt(req.params.roundNumber, 10);
      if (isNaN(tournamentId) || isNaN(roundNumber)) {
        res.status(400).json({ success: false, message: "Неверный ID" });
        return;
      }

      const check = await TournamentSwissController.assertSwissTournament(
        tournamentId,
      );
      if ("error" in check && check.error) {
        res
          .status(check.error.status)
          .json({ success: false, message: check.error.message });
        return;
      }

      const { tournament } = check;
      const teamIds = await TournamentSwissModel.getConfirmedTeamIds(
        tournamentId,
      );
      const tiebreakerOrder =
        tournament!.tiebreaker_order ?? getDefaultTiebreakerOrder();

      await TournamentSwissModel.completeRound(
        tournamentId,
        roundNumber,
        teamIds,
        tournament!.swiss_rounds!,
        tiebreakerOrder,
      );

      res.json({
        success: true,
        message:
          roundNumber >= (tournament!.swiss_rounds ?? 0)
            ? "Финальный тур завершён"
            : `Тур ${roundNumber} завершён, создан тур ${roundNumber + 1}`,
      });
    } catch (error) {
      console.error("Ошибка завершения тура:", error);
      res.status(400).json({
        success: false,
        message:
          error instanceof Error ? error.message : "Не удалось завершить тур",
      });
    }
  }
}
