import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  NoSymbolIcon,
  PencilIcon,
  PrinterIcon,
} from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "react-query";
import { adminApi } from "../../services/api";
import {
  TiebreakerCriterion,
  TournamentSwissMatchView,
  TournamentSwissStanding,
  TournamentSwissStageView,
} from "../../types";
import { handleApiError } from "../../utils";
import {
  compareSwissStandings,
  getTiebreakerLabel,
  getTiebreakerShortLabel,
  isSwissFreeTeamId,
  SWISS_FREE_TEAM_NAME,
} from "../../utils/tournamentPlaySettings";

type Props = {
  tournamentId?: number;
  swiss: TournamentSwissStageView;
  readOnly?: boolean;
  /** Свернуть блок по умолчанию (например, после начала финала) */
  defaultCollapsed?: boolean;
  /** Название турнира для шапки печати */
  tournamentName?: string;
  /** Кнопки печати (только админка) */
  showPrint?: boolean;
};

type TabId = "standings" | number;

function teamLabel(players: string[]): string {
  return players.join(", ") || "Команда";
}

/** В турах — только первый игрок (ФИО капитана/заявки). */
function teamRoundLabel(players: string[]): string {
  const first = players[0]?.trim();
  return first || "Команда";
}

function formatDiff(diff: number): string {
  if (diff > 0) {
    return `+${diff}`;
  }
  return String(diff);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function openPrintWindow(documentTitle: string, bodyHtml: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", documentTitle);
  iframe.setAttribute("aria-hidden", "true");
  // Не window.open — стандартный диалог ОС без разрешения всплывающих окон.
  // Размер не нулевой: иначе часть браузеров печатает пустую страницу.
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "800px";
  iframe.style.height = "600px";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    toast.error("Не удалось открыть диалог печати");
    return;
  }

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    iframe.remove();
  };

  frameDocument.open();
  frameDocument.write(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 13px; color: #111; margin: 24px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    .meta { color: #555; margin: 0 0 16px; font-size: 12px; }
    table { border-collapse: collapse; width: auto; }
    th, td { border: 1px solid #ccc; padding: 6px 10px; }
    th { background: #f3f4f6; font-weight: 600; text-align: center; }
    td.num, th.num { text-align: center; }
    td.team { text-align: left; white-space: nowrap; }
    .matches { width: 100%; max-width: 640px; }
    .match { display: grid; grid-template-columns: 1fr auto auto auto 1fr auto; gap: 8px; align-items: center;
      padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .match .a { text-align: right; }
    .match .b { text-align: left; }
    .match .score { font-weight: 600; min-width: 1.5rem; text-align: center; }
    .match .court { color: #555; font-size: 12px; white-space: nowrap; }
    @media print {
      body { margin: 12px; }
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`);
  frameDocument.close();

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      window.setTimeout(cleanup, 1000);
    }
  };

  frameWindow.addEventListener("afterprint", cleanup);
  window.setTimeout(triggerPrint, 100);
}

function buildStandingsPrintHtml(options: {
  tournamentName?: string;
  title: string;
  sortLegend: string;
  completedRounds: number;
  tiebreakerOrder: TiebreakerCriterion[];
  standings: TournamentSwissStanding[];
}): string {
  const {
    tournamentName,
    title,
    sortLegend,
    completedRounds,
    tiebreakerOrder,
    standings,
  } = options;
  const headerCells = [
    { label: "Место", className: "num" },
    { label: "Команда", className: "team" },
    { label: "Победы", className: "num" },
    ...tiebreakerOrder.map((c) => ({
      label: getTiebreakerShortLabel(c),
      className: "num",
    })),
    { label: "Сид", className: "num" },
  ]
    .map(
      ({ label, className }) =>
        `<th class="${className}">${escapeHtml(label)}</th>`
    )
    .join("");

  const rows = standings
    .map((row) => {
      const cells = [
        `<td class="num">${completedRounds > 0 ? row.place : "—"}</td>`,
        `<td class="team">${escapeHtml(teamLabel(row.players))}${
          row.withdrawn_from_round != null
            ? ` <span style="color:#92400e">(снялась с ${row.withdrawn_from_round} тура)</span>`
            : ""
        }</td>`,
        `<td class="num">${row.wins}</td>`,
        ...tiebreakerOrder.map((criterion) => {
          const value = row.tiebreakers?.[criterion];
          const display =
            value == null
              ? "—"
              : criterion === TiebreakerCriterion.POINT_DIFF
                ? formatDiff(value)
                : String(value);
          return `<td class="num">${escapeHtml(display)}</td>`;
        }),
        `<td class="num">${row.seed}</td>`,
      ];
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");

  const metaParts = [
    tournamentName ? escapeHtml(tournamentName) : null,
    sortLegend ? `Сортировка: ${escapeHtml(sortLegend)}` : null,
  ].filter(Boolean);

  return `
    <h1>${escapeHtml(title)}</h1>
    ${metaParts.length ? `<p class="meta">${metaParts.join(" · ")}</p>` : ""}
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildRoundPrintHtml(options: {
  tournamentName?: string;
  roundNumber: number;
  matches: TournamentSwissMatchView[];
  nameById: Map<number, string>;
}): string {
  const { tournamentName, roundNumber, matches, nameById } = options;
  const title = `Тур ${roundNumber}`;
  const rows = matches
    .map((m) => {
      const aName = escapeHtml(
        nameById.get(m.team_a_id) ?? `Команда #${m.team_a_id}`
      );
      const bName = m.is_bye
        ? escapeHtml(SWISS_FREE_TEAM_NAME)
        : escapeHtml(
            m.team_b_id != null
              ? nameById.get(m.team_b_id) ?? `Команда #${m.team_b_id}`
              : "—"
          );
      const scoreA = m.is_bye
        ? "13"
        : m.score_a != null
          ? String(m.score_a)
          : "—";
      const scoreB = m.is_bye
        ? "7"
        : m.score_b != null
          ? String(m.score_b)
          : "—";
      const court =
        m.is_bye || m.court == null ? "—" : String(m.court);
      return `<div class="match">
        <span class="a">${aName}</span>
        <span class="score">${scoreA}</span>
        <span>:</span>
        <span class="score">${scoreB}</span>
        <span class="b">${bName}</span>
        <span class="court">дорожка ${escapeHtml(court)}</span>
      </div>`;
    })
    .join("");

  return `
    <h1>${escapeHtml(title)}</h1>
    ${
      tournamentName
        ? `<p class="meta">${escapeHtml(tournamentName)}</p>`
        : ""
    }
    <div class="matches">${rows}</div>
  `;
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
    const scoreBoxClass = readOnly
      ? "inline-flex w-10 justify-center rounded border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-center font-medium text-gray-900"
      : "inline-flex w-14 justify-center rounded border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-center text-sm font-medium text-gray-900";
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className="min-w-0 flex-1 text-right text-gray-800 truncate font-medium"
          title={teamAName}
        >
          {teamAName}
        </span>
        <span className={scoreBoxClass}>13</span>
        <span className="text-gray-400">:</span>
        <span className={scoreBoxClass}>7</span>
        <span
          className="min-w-0 flex-1 text-left font-medium text-amber-900 truncate"
          title="Свободен · автопобеда"
        >
          Свободен
        </span>
        {!readOnly && (
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-200 bg-amber-50 text-[10px] font-medium leading-none text-amber-900"
            title="Автопобеда"
          >
            авто
          </span>
        )}
        <span className="shrink-0 text-sm font-medium text-gray-600">
          дорожка
        </span>
        <span className="inline-flex h-9 w-12 shrink-0 items-center justify-center rounded-md border-2 border-amber-400 bg-amber-50 text-base font-bold text-amber-950">
          —
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
  defaultCollapsed = false,
  tournamentName,
  showPrint = false,
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
      map.set(row.team_id, teamRoundLabel(row.players));
    }
    return map;
  }, [swiss.standings]);

  const [activeTab, setActiveTab] = useState<TabId>("standings");
  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);

  useEffect(() => {
    if (defaultCollapsed) {
      setSectionOpen(false);
    }
  }, [defaultCollapsed]);

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

  const tiebreakerOrder = swiss.tiebreaker_order ?? [];

  // Победы → коэффициенты из настроек турнира → сид (как на бэкенде).
  // «Свободен» в итогах не показываем.
  const sortedStandings = useMemo(() => {
    const order = swiss.tiebreaker_order ?? [];
    return swiss.standings
      .filter((row) => !isSwissFreeTeamId(row.team_id))
      .slice()
      .sort((a, b) => compareSwissStandings(a, b, order))
      .map((row, index) => ({
        ...row,
        place: index + 1,
      }));
  }, [swiss.standings, swiss.tiebreaker_order]);

  const sortLegend = [
    "Победы",
    ...tiebreakerOrder.map((c) => getTiebreakerShortLabel(c)),
    "сид",
  ].join(" → ");

  const queryClient = useQueryClient();

  const applySwissUpdate = (
    nextSwiss: TournamentSwissStageView,
    options?: { goToRound?: number; successMessage?: string }
  ) => {
    if (tournamentId == null) {
      return;
    }
    queryClient.setQueryData(
      ["tournamentInProgress", tournamentId],
      (old: unknown) => {
        if (!old || typeof old !== "object") {
          return old;
        }
        return { ...(old as object), swiss: nextSwiss };
      }
    );
    void queryClient.invalidateQueries([
      "tournamentInProgress",
      tournamentId,
    ]);
    if (options?.goToRound != null) {
      setActiveTab(options.goToRound);
    }
    if (options?.successMessage) {
      toast.success(options.successMessage);
    }
  };

  const rollbackMutation = useMutation(
    async (fromRound: number) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.rollbackSwissRound(
        tournamentId,
        fromRound
      );
      if (!response.data.success || !response.data.data?.swiss) {
        throw new Error(response.data.message || "Не удалось откатить тур");
      }
      return { swiss: response.data.data.swiss, fromRound };
    },
    {
      onSuccess: ({ swiss: nextSwiss, fromRound }) => {
        applySwissUpdate(nextSwiss, {
          goToRound: fromRound - 1,
          successMessage: `Тур ${fromRound} удалён. Можно править тур ${fromRound - 1}.`,
        });
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const advanceMutation = useMutation(
    async (fromRound: number) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.advanceSwissRound(
        tournamentId,
        fromRound
      );
      if (!response.data.success || !response.data.data?.swiss) {
        throw new Error(
          response.data.message || "Не удалось сформировать следующий тур"
        );
      }
      return { swiss: response.data.data.swiss, nextRound: fromRound + 1 };
    },
    {
      onSuccess: ({ swiss: nextSwiss, nextRound }) => {
        applySwissUpdate(nextSwiss, {
          goToRound: nextRound,
          successMessage: `Сформирован тур ${nextRound}`,
        });
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const withdrawMutation = useMutation(
    async (teamId: number) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.withdrawSwissTeam(tournamentId, teamId);
      if (!response.data.success || !response.data.data?.swiss) {
        throw new Error(
          response.data.message || "Не удалось снять команду"
        );
      }
      return { swiss: response.data.data.swiss, teamId };
    },
    {
      onSuccess: ({ swiss: nextSwiss, teamId }) => {
        const from =
          nextSwiss.standings.find((s) => s.team_id === teamId)
            ?.withdrawn_from_round ?? null;
        applySwissUpdate(nextSwiss, {
          successMessage:
            from != null
              ? `Команда снята с ${from} тура`
              : "Команда снята со швейцарки",
        });
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const reinstateMutation = useMutation(
    async (teamId: number) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.reinstateSwissTeam(tournamentId, teamId);
      if (!response.data.success || !response.data.data?.swiss) {
        throw new Error(
          response.data.message || "Не удалось вернуть команду"
        );
      }
      return response.data.data.swiss;
    },
    {
      onSuccess: (nextSwiss) => {
        applySwissUpdate(nextSwiss, {
          successMessage: "Команда снова участвует в швейцарке",
        });
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const maxExistingRound = useMemo(
    () =>
      swiss.matches.reduce((max, m) => Math.max(max, m.round_number), 0),
    [swiss.matches]
  );

  /** Можно снимать/возвращать, пока есть ещё не сформированные туры. */
  const canManageWithdrawals =
    !readOnly &&
    tournamentId != null &&
    maxExistingRound < swiss.swiss_rounds;

  const nextWithdrawRound = Math.max(swiss.completed_rounds, maxExistingRound) + 1;

  const canRollbackRound =
    !readOnly &&
    tournamentId != null &&
    typeof selectedTab === "number" &&
    selectedTab >= 2;

  const currentRoundComplete =
    typeof selectedTab === "number" &&
    activeRound != null &&
    activeRound.matches.length > 0 &&
    activeRound.matches.every(
      (m) => m.is_bye || (m.score_a != null && m.score_b != null)
    );

  const nextRoundExists =
    typeof selectedTab === "number" &&
    rounds.some((r) => r.round_number === selectedTab + 1);

  /** После перехода к следующему туру счета предыдущих только для чтения. */
  const roundScoresLocked =
    typeof selectedTab === "number" &&
    rounds.some((r) => r.round_number > selectedTab);

  // Кнопка «К следующему туру»: туры 1 … N−1, когда тур сыгран, а следующего ещё нет
  // (в т.ч. после отката к предыдущему).
  const canAdvanceRound =
    !readOnly &&
    tournamentId != null &&
    typeof selectedTab === "number" &&
    selectedTab >= 1 &&
    selectedTab < swiss.swiss_rounds &&
    currentRoundComplete &&
    !nextRoundExists;

  const printStandings = () => {
    const title = standingsTitle;
    openPrintWindow(
      tournamentName ? `${tournamentName} — ${title}` : title,
      buildStandingsPrintHtml({
        tournamentName,
        title,
        sortLegend:
          swiss.completed_rounds > 0 && tiebreakerOrder.length > 0
            ? sortLegend
            : "",
        completedRounds: swiss.completed_rounds,
        tiebreakerOrder,
        standings: sortedStandings,
      })
    );
  };

  const printActiveRound = () => {
    if (typeof selectedTab !== "number" || !activeRound) {
      return;
    }
    const title = `Тур ${selectedTab}`;
    openPrintWindow(
      tournamentName ? `${tournamentName} — ${title}` : title,
      buildRoundPrintHtml({
        tournamentName,
        roundNumber: selectedTab,
        matches: activeRound.matches,
        nameById,
      })
    );
  };

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-gray-50"
        aria-expanded={sectionOpen}
        onClick={() => setSectionOpen((open) => !open)}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Швейцарская система
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            {swiss.completed_rounds === swiss.swiss_rounds ? `Завершена` : `Проведено туров: ${swiss.completed_rounds}`}
          </p>
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
            <div className="space-y-2">
              {(swiss.completed_rounds > 0 && tiebreakerOrder.length > 0) ||
              showPrint ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {swiss.completed_rounds > 0 && tiebreakerOrder.length > 0 ? (
                    <p className="text-xs text-gray-500">
                      Сортировка мест: {sortLegend}
                    </p>
                  ) : (
                    <span />
                  )}
                  {showPrint && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={printStandings}
                    >
                      <PrinterIcon className="h-4 w-4" aria-hidden />
                      Печать
                    </button>
                  )}
                </div>
              ) : null}
              <div className="flex justify-center overflow-x-auto">
                <table className="w-auto border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                        Место
                      </th>
                      <th className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">
                        Команда
                      </th>
                      <th className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                        Победы
                      </th>
                      {tiebreakerOrder.map((criterion) => (
                        <th
                          key={criterion}
                          className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600"
                          title={getTiebreakerLabel(criterion)}
                        >
                          {getTiebreakerShortLabel(criterion)}
                        </th>
                      ))}
                      <th
                        className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-500"
                        title="Стартовый номер посева"
                      >
                        Сид
                      </th>
                      {canManageWithdrawals && (
                        <th className="whitespace-nowrap border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-500">
                          Участие
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStandings.map((row) => {
                      const name = teamLabel(row.players);
                      const withdrawnFrom = row.withdrawn_from_round ?? null;
                      const withdrawalBusy =
                        withdrawMutation.isLoading ||
                        reinstateMutation.isLoading;
                      return (
                        <tr key={row.team_id} className="bg-white">
                          <td className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center font-semibold text-gray-900">
                            {swiss.completed_rounds > 0 ? row.place : "—"}
                          </td>
                          <td className="border border-gray-200 px-2 py-1 font-medium text-gray-900">
                            <div className="whitespace-nowrap">{name}</div>
                            {withdrawnFrom != null && (
                              <div className="mt-0.5 text-xs font-normal text-amber-800">
                                Команда снялась с {withdrawnFrom} тура
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center font-semibold text-gray-900">
                            {row.wins}
                          </td>
                          {tiebreakerOrder.map((criterion) => {
                            const value = row.tiebreakers?.[criterion];
                            const display =
                              value == null
                                ? "—"
                                : criterion === TiebreakerCriterion.POINT_DIFF
                                  ? formatDiff(value)
                                  : String(value);
                            return (
                              <td
                                key={criterion}
                                className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center text-gray-700"
                              >
                                {display}
                              </td>
                            );
                          })}
                          <td
                            className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center text-gray-500"
                            title={`Рейтинг: ${row.rating}, random: ${row.random_tie}`}
                          >
                            {row.seed}
                          </td>
                          {canManageWithdrawals && (
                            <td className="whitespace-nowrap border border-gray-200 px-2 py-1 text-center">
                              {withdrawnFrom != null ? (
                                <button
                                  type="button"
                                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                  disabled={withdrawalBusy}
                                  title="Вернуть в формирование пар"
                                  onClick={() => {
                                    reinstateMutation.mutate(row.team_id);
                                  }}
                                >
                                  Вернуть
                                </button>
                              ) : nextWithdrawRound <= swiss.swiss_rounds ? (
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                                  disabled={withdrawalBusy}
                                  title={`Не включать в пары с тура ${nextWithdrawRound}`}
                                  onClick={() => {
                                    if (
                                      !window.confirm(
                                        `Снять команду «${name}» с ${nextWithdrawRound} тура и далее? В следующих турах она не будет попадать в пары.`
                                      )
                                    ) {
                                      return;
                                    }
                                    withdrawMutation.mutate(row.team_id);
                                  }}
                                >
                                  <NoSymbolIcon
                                    className="h-3.5 w-3.5"
                                    aria-hidden
                                  />
                                  Исключить
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400">—</span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeRound ? (
            <div className="space-y-3">
              {showPrint && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={printActiveRound}
                  >
                    <PrinterIcon className="h-4 w-4" aria-hidden />
                    Печать
                  </button>
                </div>
              )}
              {(canRollbackRound || canAdvanceRound || roundScoresLocked) && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-gray-500">
                    {canAdvanceRound
                      ? `Тур ${selectedTab} завершён. Сформируйте следующий, чтобы продолжить.`
                      : canRollbackRound
                        ? `Чтобы исправить счета тура ${selectedTab - 1}, удалите текущий тур и все последующие.`
                        : `Счета тура ${selectedTab} зафиксированы. Чтобы их изменить, откройте тур ${
                            (selectedTab as number) + 1
                          } и нажмите «Вернуться к туру ${selectedTab}».`}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {canRollbackRound && (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                        disabled={
                          rollbackMutation.isLoading ||
                          advanceMutation.isLoading
                        }
                        onClick={() => {
                          const fromRound = selectedTab as number;
                          if (
                            !window.confirm(
                              `Удалить тур ${fromRound}${
                                swiss.matches.some(
                                  (m) => m.round_number > fromRound
                                )
                                  ? " и все последующие"
                                  : ""
                              }? Счета тура ${fromRound - 1} останутся — их можно будет изменить.`
                            )
                          ) {
                            return;
                          }
                          rollbackMutation.mutate(fromRound);
                        }}
                      >
                        Вернуться к туру {selectedTab - 1}
                      </button>
                    )}
                    {canAdvanceRound && (
                      <button
                        type="button"
                        className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
                        disabled={
                          advanceMutation.isLoading ||
                          rollbackMutation.isLoading
                        }
                        onClick={() => {
                          advanceMutation.mutate(selectedTab as number);
                        }}
                      >
                        {advanceMutation.isLoading
                          ? "Формирование…"
                          : `К следующему туру (${(selectedTab as number) + 1})`}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <ul className="mx-auto w-full max-w-2xl space-y-2">
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
                        readOnly={readOnly || roundScoresLocked}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default TournamentSwissStageResults;
