import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from "@heroicons/react/24/outline";
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
  /** Свернуть блок по умолчанию */
  defaultCollapsed?: boolean;
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
    if (
      m.score_a == null ||
      m.score_b == null ||
      m.team_a_id == null ||
      m.team_b_id == null
    ) {
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
  bracket?: boolean;
}> = ({
  tournamentId,
  match,
  teamAName,
  teamBName,
  teamAIndex,
  teamBIndex,
  disabled,
  readOnly,
  bracket,
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

  const inputsDisabled =
    disabled ||
    mutation.isLoading ||
    locked ||
    match.team_a_id == null ||
    match.team_b_id == null;

  if (bracket) {
    const renderScore = (
      side: "a" | "b",
      value: string,
      display: number | null,
      name: string
    ) => {
      if (readOnly) {
        return (
          <span className="w-full text-center text-xs font-bold tabular-nums text-gray-800">
            {display ?? "—"}
          </span>
        );
      }
      return (
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={13}
          className={`w-full bg-transparent text-center text-xs font-bold tabular-nums outline-none focus:ring-1 focus:ring-gray-400/50 ${
            locked ? "text-emerald-700" : "text-gray-900"
          }`}
          value={value}
          disabled={inputsDisabled}
          onChange={(e) =>
            side === "a" ? setScoreA(e.target.value) : setScoreB(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && !locked) {
              lockScore();
            }
          }}
          aria-label={`Счёт ${name}`}
        />
      );
    };

    return (
      <div className="relative flex h-14 w-[210px] shrink-0">
        <div className="absolute -left-11 top-1/2 z-10 flex w-10 -translate-y-1/2 flex-col items-center gap-0.5 bg-gray-50/80 py-0.5">
          <span className="text-[9px] font-medium leading-none text-gray-600">
            дорожка
          </span>
          {readOnly ? (
            <span className="inline-flex h-7 w-10 items-center justify-center rounded border-2 border-amber-400 bg-amber-50 text-sm font-bold text-amber-950">
              {match.court ?? "—"}
            </span>
          ) : (
            <input
              type="number"
              min={1}
              max={99}
              inputMode="numeric"
              className="h-7 w-10 rounded border-2 border-amber-400 bg-amber-50 px-0.5 text-center text-sm font-bold text-amber-950 shadow-sm outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
              value={court}
              disabled={mutation.isLoading}
              onChange={(e) => setCourt(e.target.value)}
              onBlur={saveCourt}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              aria-label="Номер дорожки"
              placeholder="№"
            />
          )}
        </div>
        <div className="relative flex h-full w-full overflow-hidden rounded border border-black bg-white">
          <div className="flex min-w-0 flex-1 flex-col">
            {[teamAName, teamBName].map((name, index) => (
              <div
                key={index}
                className={`flex min-h-0 flex-1 items-center px-2 ${
                  index === 0 ? "border-b border-black/20" : ""
                }`}
              >
                <span
                  className={`min-w-0 flex-1 truncate text-[11px] leading-tight ${
                    (index === 0 ? match.team_a_id : match.team_b_id) == null
                      ? "italic text-gray-400"
                      : "font-medium text-gray-900"
                  }`}
                  title={name}
                >
                  {name}
                </span>
              </div>
            ))}
          </div>
          <div className="flex w-7 shrink-0 flex-col border-l border-black bg-gray-100">
            <div className="flex min-h-0 flex-1 items-center justify-center border-b border-black/20 px-0.5">
              {renderScore("a", scoreA, match.score_a, teamAName)}
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center px-0.5">
              {renderScore("b", scoreB, match.score_b, teamBName)}
            </div>
          </div>
          {!readOnly && (
            <div className="flex w-7 shrink-0 items-center justify-center border-l border-black bg-gray-50">
              {!locked ? (
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
                  disabled={inputsDisabled}
                  onClick={lockScore}
                  title="Зафиксировать счёт"
                >
                  <CheckIcon className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                  disabled={mutation.isLoading}
                  onClick={unlockScore}
                  title="Изменить счёт"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

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

const FRENCH_MATCH_H = 56;
const FRENCH_MATCH_W = 210;
const FRENCH_CONNECTOR_W = 36;

const FrenchGroupBracket: React.FC<{
  tournamentId?: number;
  group: TournamentGroupStageView;
  teamNameById: Map<number, string>;
  indexByTeamId: Map<number, number>;
  readOnly?: boolean;
  allMatchesPlayed: boolean;
}> = ({
  tournamentId,
  group,
  teamNameById,
  indexByTeamId,
  readOnly,
  allMatchesPlayed,
}) => {
  const firstRound = useMemo(
    () =>
      group.matches
        .filter((m) => m.round_number === 1)
        .sort(
          (a, b) =>
            (a.match_index ?? 0) - (b.match_index ?? 0) || a.id - b.id
        ),
    [group.matches]
  );

  const round2 = useMemo(
    () =>
      group.matches
        .filter((m) => m.round_number === 2 && !m.is_third_place)
        .sort(
          (a, b) =>
            (a.match_index ?? 0) - (b.match_index ?? 0) || a.id - b.id
        ),
    [group.matches]
  );

  const winnersMatch =
    round2.find((m) => m.loser_next_match_round === 3) ??
    round2.find((m) => (m.match_index ?? 0) === 0) ??
    round2[0];
  const losersMatch =
    round2.find(
      (m) => m.id !== winnersMatch?.id && m.next_match_round === 3
    ) ??
    round2.find((m) => m.id !== winnersMatch?.id) ??
    round2.find((m) => (m.match_index ?? 0) === 1);
  const placementMatch =
    group.matches.find((m) => m.round_number === 3) ??
    group.matches.find((m) => Boolean(m.is_third_place));

  const resolveName = (teamId: number | null | undefined) => {
    if (teamId == null) {
      return "Будет определён";
    }
    return teamNameById.get(teamId) ?? `Команда #${teamId}`;
  };

  const renderMatch = (match: TournamentGroupMatchView | undefined) => {
    if (!match) {
      return (
        <div
          className="flex items-center justify-center rounded border border-dashed border-gray-300 bg-white text-[11px] text-gray-400"
          style={{ height: FRENCH_MATCH_H, width: FRENCH_MATCH_W }}
        >
          Матч не создан
        </div>
      );
    }
    return (
      <MatchScoreInputs
        tournamentId={tournamentId}
        match={match}
        teamAName={resolveName(match.team_a_id)}
        teamBName={resolveName(match.team_b_id)}
        teamAIndex={
          match.team_a_id != null
            ? indexByTeamId.get(match.team_a_id)
            : undefined
        }
        teamBIndex={
          match.team_b_id != null
            ? indexByTeamId.get(match.team_b_id)
            : undefined
        }
        readOnly={readOnly}
        disabled={match.team_a_id == null || match.team_b_id == null}
        bracket
      />
    );
  };

  const matchWinnerId = (
    match: TournamentGroupMatchView | undefined
  ): number | null => {
    if (
      !match ||
      match.team_a_id == null ||
      match.team_b_id == null ||
      match.score_a == null ||
      match.score_b == null
    ) {
      return null;
    }
    return match.score_a > match.score_b ? match.team_a_id : match.team_b_id;
  };

  const matchLoserId = (
    match: TournamentGroupMatchView | undefined
  ): number | null => {
    if (
      !match ||
      match.team_a_id == null ||
      match.team_b_id == null ||
      match.score_a == null ||
      match.score_b == null
    ) {
      return null;
    }
    return match.score_a > match.score_b ? match.team_b_id : match.team_a_id;
  };

  const placeCard = (name: string | null, place: string) => (
    <div className="relative" style={{ width: FRENCH_MATCH_W }}>
      <p className="absolute -top-4 left-0 w-full text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
        {place}
      </p>
      <div className="flex h-7 items-center overflow-hidden rounded border border-black bg-white px-2">
        <span
          className={`min-w-0 truncate text-[11px] leading-tight ${
            name ? "font-medium text-gray-900" : "italic text-gray-400"
          }`}
        >
          {name ?? "Будет определён"}
        </span>
      </div>
    </div>
  );

  const winnerCard = (name: string | null) => (
    <div
      className="flex items-center overflow-hidden rounded border border-black bg-white px-2"
      style={{ height: 28, width: FRENCH_MATCH_W }}
    >
      <span
        className={`min-w-0 truncate text-[11px] leading-tight ${
          name ? "font-medium text-gray-900" : "italic text-gray-400"
        }`}
      >
        {name ?? "Будет определён"}
      </span>
    </div>
  );

  const placedTeams = [...group.teams].sort((a, b) => {
    if (a.place > 0 && b.place > 0) {
      return a.place - b.place;
    }
    if (a.place > 0) {
      return -1;
    }
    if (b.place > 0) {
      return 1;
    }
    return 0;
  });

  /*
   *  [R1-0] ─┐
   *          ├─ [Winners] ── [побед.] ── места 1..4
   *  [R1-1] ─┘
   *             [Losers]   ── [побед.]
   *             [За 2–3]   ── [побед.]
   */
  const headerH = 20;
  const stackGap = 40;
  const r1Gap = 28;
  // Как в кубках: линия заканчивается до «дорожки», дорожка в отдельном зазоре.
  const courtPad = 48;
  const col1X = 48;
  const col12Gap = FRENCH_CONNECTOR_W + courtPad;
  const col2X = col1X + FRENCH_MATCH_W + col12Gap;
  const col3X = col2X + FRENCH_MATCH_W + FRENCH_CONNECTOR_W;
  const col4X = col3X + FRENCH_MATCH_W + FRENCH_CONNECTOR_W;

  const winnersTop = headerH + 18;
  const losersTop = winnersTop + FRENCH_MATCH_H + stackGap;
  const placementTop = losersTop + FRENCH_MATCH_H + stackGap;

  const winnersC = winnersTop + FRENCH_MATCH_H / 2;
  const losersC = losersTop + FRENCH_MATCH_H / 2;
  const placementC = placementTop + FRENCH_MATCH_H / 2;

  const r1BlockH = FRENCH_MATCH_H * 2 + r1Gap;
  const r1Top0 = winnersC - r1BlockH / 2;
  const r1Top1 = r1Top0 + FRENCH_MATCH_H + r1Gap;
  const r1c0 = r1Top0 + FRENCH_MATCH_H / 2;
  const r1c1 = r1Top1 + FRENCH_MATCH_H / 2;

  const winnerCardH = 28;
  const winnersOutTop = winnersTop + (FRENCH_MATCH_H - winnerCardH) / 2;
  const losersOutTop = losersTop + (FRENCH_MATCH_H - winnerCardH) / 2;
  const placementOutTop = placementTop + (FRENCH_MATCH_H - winnerCardH) / 2;

  const placeGap = 24;
  const placeCardH = 28;
  const placesBlockH = placeCardH * 4 + placeGap * 3 + 16;
  const placesTop0 = Math.max(8, winnersC - placesBlockH / 2 + 8);
  const placeTops = [0, 1, 2, 3].map(
    (i) => placesTop0 + i * (placeCardH + placeGap)
  );

  const boardW = col4X + FRENCH_MATCH_W + 24;
  const boardH = Math.max(
    placementTop + FRENCH_MATCH_H + 24,
    placeTops[3] + placeCardH + 24
  );

  const c1Right = col1X + FRENCH_MATCH_W;
  const c2Right = col2X + FRENCH_MATCH_W;
  const mid12 = c1Right + FRENCH_CONNECTOR_W / 2;
  const col2LineEnd = col2X - courtPad;

  const nameOrNull = (id: number | null) =>
    id != null ? resolveName(id) : null;

  const winnersWinnerName = nameOrNull(matchWinnerId(winnersMatch));
  const losersWinnerName = nameOrNull(matchWinnerId(losersMatch));
  const placementWinnerName = nameOrNull(matchWinnerId(placementMatch));

  // Места: 1 — победитель верхнего, 2 — победитель матча за 2–3,
  // 3 — проигравший матча за 2–3, 4 — проигравший нижнего.
  const placeNames = [
    winnersWinnerName,
    nameOrNull(matchWinnerId(placementMatch)),
    nameOrNull(matchLoserId(placementMatch)),
    nameOrNull(matchLoserId(losersMatch)),
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">
        Французская система: во 2-м туре победители играют с победителями,
        проигравшие — с проигравшими. В 3-м туре определяется 2-е и 3-е место.
      </p>
      {!losersMatch && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Матч «проигравшие с проигравшими» не найден в данных группы. Если
          турнир стартовал со старой схемой, сбросьте проведение и запустите
          группы заново.
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">
                Команда
              </th>
              <th className="w-16 border border-gray-200 px-1 py-1.5 text-center font-medium text-gray-600">
                победы
              </th>
              <th className="w-16 border border-gray-200 px-1 py-1.5 text-center font-medium text-gray-600">
                доп
              </th>
              <th className="w-16 border border-gray-200 px-1 py-1.5 text-center font-medium text-gray-600">
                место
              </th>
            </tr>
          </thead>
          <tbody>
            {placedTeams.map((rowTeam) => {
              const name = teamLabel(rowTeam.players);
              return (
                <tr key={rowTeam.team_id} className="bg-white">
                  <td
                    className="truncate border border-gray-200 px-2 py-1 font-medium text-gray-900"
                    title={name}
                  >
                    {name}
                  </td>
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

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50/80 p-3">
        <div className="relative" style={{ width: boardW, height: boardH }}>
          <svg
            className="pointer-events-none absolute inset-0"
            width={boardW}
            height={boardH}
            aria-hidden="true"
          >
            {/* R1 → winners (линия не заходит под «дорожку») */}
            <path
              d={`M${c1Right} ${r1c0} H${mid12} V${winnersC} H${col2LineEnd}`}
              fill="none"
              stroke="black"
              strokeWidth="2"
            />
            <path
              d={`M${c1Right} ${r1c1} H${mid12} V${winnersC}`}
              fill="none"
              stroke="black"
              strokeWidth="2"
            />
            {/* winners → winner card */}
            <path
              d={`M${c2Right} ${winnersC} H${col3X}`}
              fill="none"
              stroke="black"
              strokeWidth="2"
            />
            {/* losers → winner card */}
            <path
              d={`M${c2Right} ${losersC} H${col3X}`}
              fill="none"
              stroke="black"
              strokeWidth="2"
            />
            {/* placement → winner card */}
            <path
              d={`M${c2Right} ${placementC} H${col3X}`}
              fill="none"
              stroke="black"
              strokeWidth="2"
            />
          </svg>

          <p
            className="absolute text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500"
            style={{ left: col1X, top: Math.max(0, r1Top0 - 18), width: FRENCH_MATCH_W }}
          >
            1 тур
          </p>
          <p
            className="absolute text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500"
            style={{ left: col2X, top: winnersTop - 16, width: FRENCH_MATCH_W }}
          >
            Победители
          </p>
          <p
            className="absolute text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500"
            style={{ left: col2X, top: losersTop - 16, width: FRENCH_MATCH_W }}
          >
            Проигравшие
          </p>
          <p
            className="absolute text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500"
            style={{ left: col2X, top: placementTop - 16, width: FRENCH_MATCH_W }}
          >
            За 2–3 место
          </p>
          <div className="absolute" style={{ left: col1X, top: r1Top0 }}>
            {renderMatch(firstRound[0])}
          </div>
          <div className="absolute" style={{ left: col1X, top: r1Top1 }}>
            {renderMatch(firstRound[1])}
          </div>

          <div className="absolute" style={{ left: col2X, top: winnersTop }}>
            {renderMatch(winnersMatch)}
          </div>
          <div className="absolute" style={{ left: col2X, top: losersTop }}>
            {renderMatch(losersMatch)}
          </div>
          <div className="absolute" style={{ left: col2X, top: placementTop }}>
            {renderMatch(placementMatch)}
          </div>

          <div className="absolute" style={{ left: col3X, top: winnersOutTop }}>
            {winnerCard(winnersWinnerName)}
          </div>
          <div className="absolute" style={{ left: col3X, top: losersOutTop }}>
            {winnerCard(losersWinnerName)}
          </div>
          <div
            className="absolute"
            style={{ left: col3X, top: placementOutTop }}
          >
            {winnerCard(placementWinnerName)}
          </div>

          {placeNames.map((name, index) => (
            <div
              key={`place-${index + 1}`}
              className="absolute"
              style={{ left: col4X, top: placeTops[index] }}
            >
              {placeCard(name, `${index + 1} место`)}
            </div>
          ))}
        </div>
      </div>
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

  const isFrench = group.format === "FRENCH";

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
      {isFrench ? (
        <FrenchGroupBracket
          tournamentId={tournamentId}
          group={group}
          teamNameById={teamNameById}
          indexByTeamId={indexByTeamId}
          readOnly={readOnly}
          allMatchesPlayed={allMatchesPlayed}
        />
      ) : (
        <>
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
                  m.team_a_id != null
                    ? teamNameById.get(m.team_a_id) ?? `Команда #${m.team_a_id}`
                    : "Будет определён";
                const bName =
                  m.team_b_id != null
                    ? teamNameById.get(m.team_b_id) ?? `Команда #${m.team_b_id}`
                    : "Будет определён";
                const aIdx =
                  m.team_a_id != null ? indexByTeamId.get(m.team_a_id) : undefined;
                const bIdx =
                  m.team_b_id != null ? indexByTeamId.get(m.team_b_id) : undefined;
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
        </>
      )}
    </div>
  );
};

export const TournamentGroupStageResults: React.FC<Props> = ({
  tournamentId,
  groups,
  readOnly = false,
  defaultCollapsed = false,
}) => {
  const sortedGroups = useMemo(
    () =>
      [...groups].sort((a, b) => a.group_number - b.group_number),
    [groups]
  );

  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);
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
    <div className="card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-gray-50"
        aria-expanded={sectionOpen}
        onClick={() => setSectionOpen((open) => !open)}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Групповой этап</h2>
          {readOnly && (
            <p className="mt-1 text-sm text-gray-500">Только просмотр</p>
          )}
        </div>
        {sectionOpen ? (
          <ChevronUpIcon className="h-5 w-5 shrink-0 text-gray-500" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 shrink-0 text-gray-500" />
        )}
      </button>

      {sectionOpen && (
        <div className="space-y-4 border-t border-gray-200 px-6 py-4">
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
      )}
    </div>
  );
};

export default TournamentGroupStageResults;
