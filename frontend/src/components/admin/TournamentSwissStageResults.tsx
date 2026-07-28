import { CheckIcon, PencilIcon } from "@heroicons/react/24/outline";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "react-query";
import { adminApi } from "../../services/api";
import {
  TournamentSwissMatchView,
  TournamentSwissStageView,
} from "../../types";
import { handleApiError } from "../../utils";

type Props = {
  tournamentId?: number;
  swiss: TournamentSwissStageView;
  readOnly?: boolean;
};

type TabId = "standings" | number;

function teamLabel(players: string[]): string {
  return players.join(", ") || "Команда";
}

function formatDiff(diff: number): string {
  if (diff > 0) {
    return `+${diff}`;
  }
  return String(diff);
}

const SwissMatchScoreInputs: React.FC<{
  tournamentId?: number;
  match: TournamentSwissMatchView;
  teamAName: string;
  teamBName: string;
  readOnly?: boolean;
}> = ({ tournamentId, match, teamAName, teamBName, readOnly }) => {
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
      const response = await adminApi.updateTournamentSwissMatch(
        tournamentId,
        match.id,
        payload
      );
      if (!response.data.success) {
        throw new Error(response.data.message || "Не удалось сохранить");
      }
      return response.data.data?.swiss;
    },
    {
      onSuccess: (swiss, variables) => {
        if (tournamentId == null) {
          return;
        }
        if (swiss) {
          queryClient.setQueryData(
            ["tournamentInProgress", tournamentId],
            (old: unknown) => {
              if (!old || typeof old !== "object") {
                return old;
              }
              return { ...(old as object), swiss };
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

  if (match.is_bye) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        <span className="min-w-0 flex-1 truncate font-medium" title={teamAName}>
          {teamAName}
        </span>
        <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900">
          bye · автопобеда
        </span>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className="min-w-0 flex-1 text-right text-gray-800 truncate"
          title={teamAName}
        >
          {teamAName}
        </span>
        <span
          className={`inline-flex w-10 justify-center rounded border px-1.5 py-1 text-center font-medium ${
            hasSavedScore
              ? "border-emerald-300 bg-emerald-50 text-gray-900"
              : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          {match.score_a != null ? match.score_a : "—"}
        </span>
        <span className="text-gray-400">:</span>
        <span
          className={`inline-flex w-10 justify-center rounded border px-1.5 py-1 text-center font-medium ${
            hasSavedScore
              ? "border-emerald-300 bg-emerald-50 text-gray-900"
              : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
        >
          {match.score_b != null ? match.score_b : "—"}
        </span>
        <span
          className="min-w-0 flex-1 text-left text-gray-800 truncate"
          title={teamBName}
        >
          {teamBName}
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

  const inputsDisabled = mutation.isLoading || locked;
  const scoreInputClass = `w-14 rounded border px-1.5 py-1 text-center text-sm ${
    locked
      ? "border-emerald-300 bg-emerald-50 text-gray-900"
      : "border-gray-300 disabled:bg-gray-100"
  }`;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span
        className="min-w-0 flex-1 text-right text-gray-800 truncate"
        title={teamAName}
      >
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
      <span
        className="min-w-0 flex-1 text-left text-gray-800 truncate"
        title={teamBName}
      >
        {teamBName}
      </span>
      {locked ? (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
          onClick={() => setLocked(false)}
          title="Изменить счёт"
          aria-label="Изменить счёт"
        >
          <PencilIcon className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
          onClick={lockScore}
          disabled={mutation.isLoading}
          title="Сохранить счёт"
          aria-label="Сохранить счёт"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
      )}
      <span className="shrink-0 text-sm font-medium text-gray-600">дорожка</span>
      <input
        type="number"
        min={1}
        max={99}
        className="h-9 w-12 rounded-md border-2 border-amber-400 bg-amber-50 px-1 text-center text-base font-bold text-amber-950"
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
      />
    </div>
  );
};

export const TournamentSwissStageResults: React.FC<Props> = ({
  tournamentId,
  swiss,
  readOnly = false,
}) => {
  const rounds = useMemo(() => {
    const byRound = new Map<number, TournamentSwissMatchView[]>();
    for (const m of swiss.matches) {
      if (!byRound.has(m.round_number)) {
        byRound.set(m.round_number, []);
      }
      byRound.get(m.round_number)!.push(m);
    }
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round_number, matches]) => ({ round_number, matches }));
  }, [swiss.matches]);

  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of swiss.standings) {
      map.set(row.team_id, teamLabel(row.players));
    }
    return map;
  }, [swiss.standings]);

  const [activeTab, setActiveTab] = useState<TabId>("standings");

  const selectedTab: TabId =
    activeTab === "standings" ||
    rounds.some((r) => r.round_number === activeTab)
      ? activeTab
      : "standings";

  const activeRound =
    typeof selectedTab === "number"
      ? rounds.find((r) => r.round_number === selectedTab)
      : null;

  const standingsTitle =
    swiss.completed_rounds > 0
      ? `Итоги швейцарки (после ${swiss.completed_rounds} туров)`
      : "Итоги швейцарки";

  return (
    <div className="card p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Швейцарская система
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Запланировано туров: {swiss.swiss_rounds}
        </p>
      </div>

      <div
        className="flex flex-wrap gap-1 border-b border-gray-200"
        role="tablist"
        aria-label="Туры швейцарки"
      >
        <button
          type="button"
          role="tab"
          aria-selected={selectedTab === "standings"}
          className={`rounded-t-md px-3 py-2 text-sm font-medium ${
            selectedTab === "standings"
              ? "border border-b-white border-gray-200 bg-white text-primary-700 -mb-px"
              : "text-gray-600 hover:text-gray-900"
          }`}
          onClick={() => setActiveTab("standings")}
        >
          {standingsTitle}
        </button>
        {rounds.map(({ round_number }) => (
          <button
            key={round_number}
            type="button"
            role="tab"
            aria-selected={selectedTab === round_number}
            className={`rounded-t-md px-3 py-2 text-sm font-medium ${
              selectedTab === round_number
                ? "border border-b-white border-gray-200 bg-white text-primary-700 -mb-px"
                : "text-gray-600 hover:text-gray-900"
            }`}
            onClick={() => setActiveTab(round_number)}
          >
            Тур {round_number}
          </button>
        ))}
      </div>

      {selectedTab === "standings" ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                  Место
                </th>
                <th className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">
                  Команда
                </th>
                <th className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                  Стартовая позиция
                </th>
                <th className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                  Победы
                </th>
                <th className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                  ±
                </th>
                <th className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                  Очки+
                </th>
                <th className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                  Игры
                </th>
              </tr>
            </thead>
            <tbody>
              {swiss.standings.map((row) => {
                const name = teamLabel(row.players);
                return (
                  <tr key={row.team_id} className="bg-white">
                    <td className="border border-gray-200 px-2 py-1 text-center text-gray-700">
                      {swiss.completed_rounds > 0 ? row.place : "—"}
                    </td>
                    <td
                      className="border border-gray-200 px-2 py-1 font-medium text-gray-900"
                      title={name}
                    >
                      {name}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-left text-gray-600 whitespace-nowrap">
                      {row.seed} (рейтинг: {row.rating}, random:{" "}
                      {row.random_tie})
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-center font-medium text-gray-900">
                      {row.wins}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-center text-gray-700">
                      {formatDiff(row.point_diff)}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-center text-gray-700">
                      {row.points_for}
                    </td>
                    <td className="border border-gray-200 px-2 py-1 text-center text-gray-600">
                      {row.played}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : activeRound ? (
        <ul className="space-y-2">
          {activeRound.matches.map((m) => {
            const aName =
              nameById.get(m.team_a_id) ?? `Команда #${m.team_a_id}`;
            const bName =
              m.team_b_id != null
                ? nameById.get(m.team_b_id) ?? `Команда #${m.team_b_id}`
                : "";
            return (
              <li
                key={m.id}
                className="rounded-md border border-gray-200 bg-white px-3 py-2"
              >
                <SwissMatchScoreInputs
                  tournamentId={tournamentId}
                  match={m}
                  teamAName={aName}
                  teamBName={bName}
                  readOnly={readOnly}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
};

export default TournamentSwissStageResults;
