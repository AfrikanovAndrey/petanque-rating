import React, { useEffect, useMemo, useState } from "react";
import {
  SwissRoundStatus,
  TiebreakerCriterion,
  Tournament,
  TournamentSwissMatch,
  TournamentSwissSnapshot,
  TournamentSwissStanding,
} from "../types";
import {
  SWISS_BYE_SCORE,
  formatStandingPoints,
  getSwissRoundStatusLabel,
  getTiebreakerLabel,
  standingsTiebreakerColumns,
} from "../utils/tournamentPlaySettings";

type PublicSwissPanelProps = {
  tournament: Tournament;
  swiss?: TournamentSwissSnapshot | null;
};

const DEFAULT_TIEBREAKER_ORDER: TiebreakerCriterion[] = [
  TiebreakerCriterion.BUCHHOLZ,
  TiebreakerCriterion.POINT_DIFF,
];

function coerceNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function getTiebreakerValue(
  standing: TournamentSwissStanding,
  criterion: TiebreakerCriterion,
): number | null {
  switch (criterion) {
    case TiebreakerCriterion.BUCHHOLZ:
      return coerceNumber(standing.buchholz);
    case TiebreakerCriterion.DOUBLE_BUCHHOLZ:
      return coerceNumber(standing.double_buchholz);
    case TiebreakerCriterion.BERGER:
      return coerceNumber(standing.berger);
    case TiebreakerCriterion.PROGRESS:
      return coerceNumber(standing.progress);
    case TiebreakerCriterion.POINT_DIFF:
      return coerceNumber(standing.point_diff);
    default:
      return null;
  }
}

function formatTiebreakerValue(value: number | null): string {
  if (value == null) {
    return "—";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function TeamPlayersColumn({
  players,
  align = "left",
}: {
  players?: string | null;
  align?: "left" | "right";
}) {
  const names = (players ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return (
      <div
        className={`text-sm text-gray-400 ${align === "right" ? "text-right" : "text-left"}`}
      >
        —
      </div>
    );
  }

  return (
    <div
      className={`text-sm text-gray-900 leading-snug ${align === "right" ? "text-right" : "text-left"}`}
    >
      {names.map((name) => (
        <div key={name}>{name}</div>
      ))}
    </div>
  );
}

function PublicSwissMatchRow({ match }: { match: TournamentSwissMatch }) {
  const displayScoreA = match.is_bye ? SWISS_BYE_SCORE.a : match.score_a;
  const displayScoreB = match.is_bye ? SWISS_BYE_SCORE.b : match.score_b;

  const scoreCell = match.is_bye ? (
    <div className="text-center text-sm font-medium text-gray-900 tabular-nums">
      {SWISS_BYE_SCORE.a}:{SWISS_BYE_SCORE.b}
    </div>
  ) : (
    <div className="text-center text-sm font-medium text-gray-900 tabular-nums">
      {displayScoreA != null && displayScoreB != null
        ? `${displayScoreA}:${displayScoreB}`
        : "—"}
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(10rem,14rem)_10.5rem_minmax(10rem,14rem)] items-center gap-3 py-3 border-b border-gray-100 last:border-b-0">
      <TeamPlayersColumn players={match.team_a_players} align="right" />
      {scoreCell}
      <TeamPlayersColumn
        players={match.is_bye ? "Свободен" : match.team_b_players}
        align="left"
      />
    </div>
  );
}

const PublicSwissPanel: React.FC<PublicSwissPanelProps> = ({
  tournament,
  swiss,
}) => {
  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | null>(
    null,
  );

  const rounds = swiss?.rounds ?? [];
  const matches = swiss?.matches ?? [];
  const standings = swiss?.standings ?? [];

  const viewableRounds = useMemo(
    () =>
      rounds.filter((round) => round.status !== SwissRoundStatus.PENDING),
    [rounds],
  );

  const activeRound = useMemo(
    () =>
      rounds.find((round) => round.status === SwissRoundStatus.IN_PROGRESS),
    [rounds],
  );

  useEffect(() => {
    if (viewableRounds.length === 0) {
      setSelectedRoundNumber(null);
      return;
    }
    if (
      selectedRoundNumber == null ||
      !viewableRounds.some((round) => round.round_number === selectedRoundNumber)
    ) {
      setSelectedRoundNumber(
        activeRound?.round_number ??
          viewableRounds[viewableRounds.length - 1].round_number,
      );
    }
  }, [viewableRounds, activeRound, selectedRoundNumber]);

  const selectedRoundMatches = useMemo(
    () =>
      matches.filter((match) => match.round_number === selectedRoundNumber),
    [matches, selectedRoundNumber],
  );

  const tiebreakerColumns = useMemo(
    () =>
      standingsTiebreakerColumns(
        tournament.tiebreaker_order,
        DEFAULT_TIEBREAKER_ORDER,
      ),
    [tournament.tiebreaker_order],
  );

  const sortedStandings = useMemo(
    () =>
      [...standings].sort((a, b) => {
        const rankA = a.rank_position ?? Number.MAX_SAFE_INTEGER;
        const rankB = b.rank_position ?? Number.MAX_SAFE_INTEGER;
        return rankA - rankB;
      }),
    [standings],
  );

  if (!swiss?.initialized) {
    return null;
  }

  const currentRoundLabel =
    tournament.swiss_current_round != null
      ? `Текущий тур: ${tournament.swiss_current_round}${
          tournament.swiss_rounds != null
            ? ` из ${tournament.swiss_rounds}`
            : ""
        }`
      : "Текущий тур не начат";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Швейцарская система
          </h2>
          <p className="mt-1 text-sm text-gray-500">{currentRoundLabel}</p>
        </div>

        {viewableRounds.length === 0 ? (
          <div className="px-4 sm:px-6 py-10 text-center text-gray-500">
            Нет доступных туров.
          </div>
        ) : (
          <>
            <div className="border-b border-gray-200 px-4 sm:px-6 py-3">
              <div className="flex flex-wrap gap-2">
                {viewableRounds.map((round) => {
                  const isActive = round.round_number === selectedRoundNumber;
                  return (
                    <button
                      key={round.id}
                      type="button"
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-primary-600 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setSelectedRoundNumber(round.round_number)}
                    >
                      Тур {round.round_number}
                      <span className="ml-1.5 text-xs opacity-80">
                        ({getSwissRoundStatusLabel(round.status)})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4">
              {selectedRoundMatches.length === 0 ? (
                <p className="text-sm text-gray-500">В этом туре нет матчей.</p>
              ) : (
                <div>
                  {selectedRoundMatches.map((match) => (
                    <PublicSwissMatchRow key={match.id} match={match} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="border-b border-gray-200 px-4 sm:px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Турнирная таблица
          </h2>
        </div>
        {sortedStandings.length === 0 ? (
          <div className="px-4 sm:px-6 py-10 text-center text-gray-500">
            Таблица пока пуста.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    №
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Команда
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Победы
                  </th>
                  {tiebreakerColumns.map((criterion) => (
                    <th
                      key={criterion}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap"
                    >
                      {getTiebreakerLabel(criterion)}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Очки
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {sortedStandings.map((standing, index) => (
                  <tr key={standing.id}>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center">
                      {standing.rank_position ?? index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-left">
                      <TeamPlayersColumn players={standing.team_players} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-center">
                      {standing.wins}
                    </td>
                    {tiebreakerColumns.map((criterion) => (
                      <td
                        key={criterion}
                        className="px-4 py-3 text-sm text-gray-900 text-center tabular-nums"
                      >
                        {formatTiebreakerValue(
                          getTiebreakerValue(standing, criterion),
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-sm text-gray-900 text-center tabular-nums whitespace-nowrap">
                      {formatStandingPoints(standing)}
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

export default PublicSwissPanel;
