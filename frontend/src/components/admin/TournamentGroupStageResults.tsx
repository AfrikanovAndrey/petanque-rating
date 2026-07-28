import { CheckIcon, PencilIcon } from "@heroicons/react/24/outline";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "react-query";
import { adminApi } from "../../services/api";
import {
  TournamentGroupMatchView,
  TournamentGroupStageView,
} from "../../types";
import { handleApiError } from "../../utils";
import { getGroupLetter } from "../../utils/tournamentPlaySettings";

type Props = {
  tournamentId?: number;
  groups: TournamentGroupStageView[];
  /** Только просмотр (публичная страница) */
  readOnly?: boolean;
};

function formatDiff(diff: number): string {
  if (diff > 0) {
    return `+${diff}`;
  }
  return String(diff);
}

function teamLabel(players: string[]): string {
  return players.join(", ") || "Команда";
}

function findMatchCell(
  matches: TournamentGroupMatchView[],
  rowTeamId: number,
  colTeamId: number
): { score_for: number; score_against: number; diff: number } | null {
  for (const m of matches) {
    if (m.score_a == null || m.score_b == null) {
      continue;
    }
    if (m.team_a_id === rowTeamId && m.team_b_id === colTeamId) {
      return {
        score_for: m.score_a,
        score_against: m.score_b,
        diff: m.score_a - m.score_b,
      };
    }
    if (m.team_b_id === rowTeamId && m.team_a_id === colTeamId) {
      return {
        score_for: m.score_b,
        score_against: m.score_a,
        diff: m.score_b - m.score_a,
      };
    }
  }
  return null;
}

const MatchScoreInputs: React.FC<{
  tournamentId?: number;
  match: TournamentGroupMatchView;
  teamAName: string;
  teamBName: string;
  teamAIndex?: number;
  teamBIndex?: number;
  disabled?: boolean;
  readOnly?: boolean;
}> = ({
  tournamentId,
  match,
  teamAName,
  teamBName,
  teamAIndex,
  teamBIndex,
  disabled,
  readOnly,
}) => {
  const queryClient = useQueryClient();
  const hasSavedScore = match.score_a != null && match.score_b != null;
  const [locked, setLocked] = useState(hasSavedScore);
  const [scoreA, setScoreA] = useState(
    match.score_a != null ? String(match.score_a) : ""
  );
  const [scoreB, setScoreB] = useState(
    match.score_b != null ? String(match.score_b) : ""
  );
  const [court, setCourt] = useState(
    match.court != null ? String(match.court) : ""
  );

  React.useEffect(() => {
    setScoreA(match.score_a != null ? String(match.score_a) : "");
    setScoreB(match.score_b != null ? String(match.score_b) : "");
    setCourt(match.court != null ? String(match.court) : "");
    setLocked(match.score_a != null && match.score_b != null);
  }, [match.score_a, match.score_b, match.court, match.id]);

  const mutation = useMutation(
    async (
      payload:
        | { score_a: number; score_b: number }
        | { clear: true }
        | { court: number | null }
    ) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.updateTournamentGroupMatch(
        tournamentId,
        match.id,
        payload
      );
      if (!response.data.success) {
        throw new Error(response.data.message || "Не удалось сохранить");
      }
      return response.data.data?.groups;
    },
    {
      onSuccess: (groups, variables) => {
        if (tournamentId == null) {
          return;
        }
        if (groups) {
          queryClient.setQueryData(
            ["tournamentInProgress", tournamentId],
            (old: unknown) => {
              if (!old || typeof old !== "object") {
                return old;
              }
              return { ...(old as object), groups };
            }
          );
        }
        void queryClient.invalidateQueries([
          "tournamentInProgress",
          tournamentId,
        ]);
        if ("clear" in variables) {
          setLocked(false);
          setScoreA("");
          setScoreB("");
        } else if ("score_a" in variables) {
          setLocked(true);
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
        setScoreA(match.score_a != null ? String(match.score_a) : "");
        setScoreB(match.score_b != null ? String(match.score_b) : "");
        setCourt(match.court != null ? String(match.court) : "");
        setLocked(match.score_a != null && match.score_b != null);
      },
    }
  );

  const lockScore = () => {
    const aRaw = scoreA.trim();
    const bRaw = scoreB.trim();
    if (aRaw === "" && bRaw === "") {
      if (hasSavedScore) {
        mutation.mutate({ clear: true });
      } else {
        toast.error("Введите счёт обеих команд");
      }
      return;
    }
    if (aRaw === "" || bRaw === "") {
      toast.error("Введите счёт обеих команд");
      return;
    }
    const a = parseInt(aRaw, 10);
    const b = parseInt(bRaw, 10);
    if (
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a > 13 ||
      b > 13
    ) {
      toast.error("Счёт должен быть от 0 до 13");
      return;
    }
    if (a === b) {
      toast.error("Партия не может закончиться ничьей");
      return;
    }
    if (a === match.score_a && b === match.score_b) {
      setLocked(true);
      return;
    }
    mutation.mutate({ score_a: a, score_b: b });
  };

  const saveCourt = () => {
    const raw = court.trim();
    if (raw === "") {
      if (match.court == null) {
        return;
      }
      mutation.mutate({ court: null });
      return;
    }
    const c = parseInt(raw, 10);
    if (!Number.isInteger(c) || c < 1 || c > 99) {
      toast.error("Номер дорожки должен быть от 1 до 99");
      setCourt(match.court != null ? String(match.court) : "");
      return;
    }
    if (c === match.court) {
      return;
    }
    mutation.mutate({ court: c });
  };

  const unlockScore = () => {
    setLocked(false);
  };

  const inputsDisabled = disabled || mutation.isLoading || locked;

  const scoreInputClass = `w-14 rounded border px-1.5 py-1 text-center text-sm ${
    locked
      ? "border-emerald-300 bg-emerald-50 text-gray-900"
      : "border-gray-300 disabled:bg-gray-100"
  }`;

  if (readOnly) {
    const scoreAText =
      match.score_a != null ? String(match.score_a) : "—";
    const scoreBText =
      match.score_b != null ? String(match.score_b) : "—";
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className="min-w-0 flex-1 text-right text-gray-800 truncate"
          title={teamAName}
        >
          {teamAIndex != null && (
            <span className="inline-flex h-5 w-8 shrink-0 items-center justify-center text-xs font-semibold text-gray-500">
              ({teamAIndex})
            </span>
          )}
          {teamAName}
        </span>
        <span
          className={`inline-flex w-10 justify-center rounded border px-1.5 py-1 text-center font-medium ${
            hasSavedScore
              ? "border-emerald-300 bg-emerald-50 text-gray-900"
              : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          {scoreAText}
        </span>
        <span className="text-gray-400">:</span>
        <span
          className={`inline-flex w-10 justify-center rounded border px-1.5 py-1 text-center font-medium ${
            hasSavedScore
              ? "border-emerald-300 bg-emerald-50 text-gray-900"
              : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          {scoreBText}
        </span>
        <span
          className="min-w-0 flex-1 text-left text-gray-800 truncate"
          title={teamBName}
        >
          {teamBName}
          {teamBIndex != null && (
            <span className="inline-flex h-5 w-8 shrink-0 items-center justify-center text-xs font-semibold text-gray-500">
              ({teamBIndex})
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm font-medium text-gray-600">
          дорожка
        </span>
        <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-md border-2 border-amber-400 bg-amber-50 text-base font-bold text-amber-950">
          {match.court != null ? match.court : "—"}
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className="min-w-0 flex-1 text-right text-gray-800 truncate"
        title={teamAName}
      >
        {teamAIndex != null && (
          <span className="inline-flex h-5 w-8 shrink-0 items-center justify-center text-xs font-semibold text-gray-500">
            ({teamAIndex})
          </span>
        )}
        {teamAName}
      </span>
      <input
        type="number"
        min={0}
        max={13}
        className={scoreInputClass}
        value={scoreA}
        disabled={inputsDisabled}
        onChange={(e) => setScoreA(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !locked) {
            lockScore();
          }
        }}
        aria-label={`Счёт ${teamAName}`}
      />
      <span className="text-gray-400">:</span>
      <input
        type="number"
        min={0}
        max={13}
        className={scoreInputClass}
        value={scoreB}
        disabled={inputsDisabled}
        onChange={(e) => setScoreB(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !locked) {
            lockScore();
          }
        }}
        aria-label={`Счёт ${teamBName}`}
      />
      {!locked ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          disabled={disabled || mutation.isLoading}
          onClick={lockScore}
          title="Зафиксировать счёт"
          aria-label="Зафиксировать счёт"
        >
          {mutation.isLoading ? (
            <span className="text-xs">…</span>
          ) : (
            <CheckIcon className="h-4 w-4" />
          )}
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          disabled={disabled || mutation.isLoading}
          onClick={unlockScore}
          title="Изменить счёт"
          aria-label="Изменить счёт"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      )}
      <span
        className="min-w-0 flex-1 text-left text-gray-800 truncate"
        title={teamBName}
      >
        {teamBName}
        {teamBIndex != null && (
          <span className="inline-flex h-5 w-8 shrink-0 items-center justify-center text-xs font-semibold text-gray-500">
            ({teamBIndex})
          </span>
        )}
      </span>
      <span className="shrink-0 text-sm font-medium text-gray-600">дорожка</span>
      <input
        type="number"
        min={1}
        max={99}
        className="h-9 w-12 shrink-0 rounded-md border-2 border-amber-400 bg-amber-50 px-1 text-center text-base font-bold text-amber-950 shadow-sm disabled:opacity-60"
        value={court}
        disabled={disabled || mutation.isLoading}
        onChange={(e) => setCourt(e.target.value)}
        onBlur={saveCourt}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        }}
        aria-label="Номер дорожки"
        title="Номер дорожки"
        placeholder="№"
      />
    </div>
  );
};

const GroupResultsPanel: React.FC<{
  tournamentId?: number;
  group: TournamentGroupStageView;
  readOnly?: boolean;
}> = ({ tournamentId, group, readOnly }) => {
  const teamNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of group.teams) {
      map.set(t.team_id, teamLabel(t.players));
    }
    return map;
  }, [group.teams]);

  const indexByTeamId = useMemo(() => {
    const map = new Map<number, number>();
    group.teams.forEach((t, i) => map.set(t.team_id, i + 1));
    return map;
  }, [group.teams]);

  const orderedTeams = group.teams;

  const allMatchesPlayed = useMemo(
    () =>
      group.matches.length > 0 &&
      group.matches.every((m) => m.score_a != null && m.score_b != null),
    [group.matches]
  );

  const rounds = useMemo(() => {
    const byRound = new Map<number, TournamentGroupMatchView[]>();
    for (const m of group.matches) {
      if (!byRound.has(m.round_number)) {
        byRound.set(m.round_number, []);
      }
      byRound.get(m.round_number)!.push(m);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round_number, matches]) => ({ round_number, matches }));
  }, [group.matches]);

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="w-8 border border-gray-200 px-1 py-1.5 text-center font-medium text-gray-600">
                №
              </th>
              <th className="w-52 border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">
                Команда
              </th>
              {orderedTeams.map((_, i) => (
                <th
                  key={i}
                  className="w-14 border border-gray-200 px-1 py-1.5 text-center font-medium text-gray-600"
                >
                  {i + 1}
                </th>
              ))}
              <th className="w-12 border border-gray-200 px-1 py-1.5 text-center font-medium text-gray-600">
                победы
              </th>
              <th className="w-10 border border-gray-200 px-1 py-1.5 text-center font-medium text-gray-600">
                доп
              </th>
              <th className="w-10 border border-gray-200 px-1 py-1.5 text-center font-medium text-gray-600">
                место
              </th>
            </tr>
          </thead>
          <tbody>
            {orderedTeams.map((rowTeam, rowIndex) => {
              const name = teamLabel(rowTeam.players);
              return (
                <tr key={rowTeam.team_id} className="bg-white">
                  <td className="border border-gray-200 px-1 py-1 text-center text-gray-500">
                    {rowIndex + 1}
                  </td>
                  <td
                    className="truncate border border-gray-200 px-2 py-1 font-medium text-gray-900"
                    title={name}
                  >
                    {name}
                  </td>
                  {orderedTeams.map((colTeam, colIndex) => {
                    if (rowIndex === colIndex) {
                      return (
                        <td
                          key={colTeam.team_id}
                          className="border border-gray-200 bg-gray-900"
                        />
                      );
                    }
                    const cell = findMatchCell(
                      group.matches,
                      rowTeam.team_id,
                      colTeam.team_id
                    );
                    return (
                      <td
                        key={colTeam.team_id}
                        className="border border-gray-200 px-1 py-0.5 text-center align-middle"
                      >
                        {cell ? (
                          <div className="leading-tight">
                            <div className="text-xs font-medium text-gray-900">
                              {cell.score_for}:{cell.score_against}
                            </div>
                            <div
                              className={`text-[10px] ${
                                cell.diff > 0
                                  ? "text-emerald-700"
                                  : cell.diff < 0
                                    ? "text-red-600"
                                    : "text-gray-500"
                              }`}
                            >
                              {formatDiff(cell.diff)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300">·</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="border border-gray-200 px-1 py-1 text-center font-semibold">
                    {rowTeam.wins}
                  </td>
                  <td className="border border-gray-200 px-1 py-1 text-center">
                    {formatDiff(rowTeam.point_diff)}
                  </td>
                  <td className="border border-gray-200 px-1 py-1 text-center font-semibold">
                    {allMatchesPlayed && rowTeam.place > 0
                      ? rowTeam.place
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-4">
        {rounds.map(({ round_number, matches }) => (
          <div key={round_number}>
            <p className="mb-2 text-sm font-semibold text-gray-800">
              Тур {round_number}
            </p>
            <ul className="space-y-2">
              {matches.map((m) => {
                const aName =
                  teamNameById.get(m.team_a_id) ?? `Команда #${m.team_a_id}`;
                const bName =
                  teamNameById.get(m.team_b_id) ?? `Команда #${m.team_b_id}`;
                const aIdx = indexByTeamId.get(m.team_a_id);
                const bIdx = indexByTeamId.get(m.team_b_id);
                return (
                  <li
                    key={m.id}
                    className="rounded-md border border-gray-200 bg-white px-3 py-2"
                  >
                    <MatchScoreInputs
                      tournamentId={tournamentId}
                      match={m}
                      teamAName={aName}
                      teamBName={bName}
                      teamAIndex={aIdx}
                      teamBIndex={bIdx}
                      readOnly={readOnly}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TournamentGroupStageResults: React.FC<Props> = ({
  tournamentId,
  groups,
  readOnly = false,
}) => {
  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) => a.group_number - b.group_number),
    [groups]
  );

  const [activeGroupNumber, setActiveGroupNumber] = useState<number | null>(
    null
  );

  const selectedGroupNumber =
    activeGroupNumber != null &&
    sortedGroups.some((g) => g.group_number === activeGroupNumber)
      ? activeGroupNumber
      : sortedGroups[0]?.group_number ?? null;

  const activeGroup = sortedGroups.find(
    (g) => g.group_number === selectedGroupNumber
  );

  if (!sortedGroups.length) {
    return null;
  }

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Групповой этап</h2>
        {readOnly && tournamentId != null && (
          <p className="mt-1 text-sm text-gray-500">
            Финал уже начат — результаты групп только для просмотра
          </p>
        )}
      </div>

      <div
        className="flex flex-wrap gap-1 border-b border-gray-200"
        role="tablist"
        aria-label="Группы"
      >
        {sortedGroups.map((group) => {
          const letter = getGroupLetter(group.group_number);
          const isActive = group.group_number === selectedGroupNumber;
          return (
            <button
              key={group.group_number}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-primary-600 text-primary-700"
                  : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
              }`}
              onClick={() => setActiveGroupNumber(group.group_number)}
            >
              Группа {letter}
            </button>
          );
        })}
      </div>

      {activeGroup && (
        <div role="tabpanel" className="pt-2">
          <GroupResultsPanel
            tournamentId={tournamentId}
            group={activeGroup}
            readOnly={readOnly}
          />
        </div>
      )}
    </div>
  );
};

export default TournamentGroupStageResults;
