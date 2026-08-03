import { CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon, PrinterIcon } from "@heroicons/react/24/outline";
import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useMutation, useQueryClient } from "react-query";
import { adminApi } from "../../services/api";
import {
  CupBracketCode,
  TournamentCupMatchView,
  TournamentCupStageView,
} from "../../types";
import { handleApiError } from "../../utils";

type Props = {
  tournamentId?: number;
  cups: TournamentCupStageView[];
  readOnly?: boolean;
  /** Кнопки печати (только админка) */
  showPrint?: boolean;
  /** Название турнира для шапки печати */
  tournamentName?: string;
  /** Свернуть блок по умолчанию */
  defaultCollapsed?: boolean;
};

const MATCH_H = 56;
const MATCH_W = 210;
const CONNECTOR_W = 28;
const ROUND_GAP = 14;
const SLOT = MATCH_H + ROUND_GAP;

function teamLabel(players: string[]): string {
  if (!players.length) {
    return "Будет определен";
  }
  const first = players[0]?.trim();
  return first || "Будет определен";
}

function matchWinnerPlayers(
  match: TournamentCupMatchView
): string[] | null {
  if (
    match.score_a == null ||
    match.score_b == null ||
    match.team_a_id == null ||
    match.team_b_id == null
  ) {
    return null;
  }
  if (match.score_a > match.score_b) {
    return match.team_a_players;
  }
  if (match.score_b > match.score_a) {
    return match.team_b_players;
  }
  return null;
}

/** Верх карточки матча в раунде roundIdx (0 = первый). */
function matchTop(roundIdx: number, matchIdx: number): number {
  const stride = 2 ** roundIdx;
  const center = (matchIdx + 0.5) * stride * SLOT - ROUND_GAP / 2;
  return center - MATCH_H / 2;
}

function matchCenterY(roundIdx: number, matchIdx: number): number {
  return matchTop(roundIdx, matchIdx) + MATCH_H / 2;
}

function cupTabLabel(cup: CupBracketCode): string {
  if (cup === "AB") {
    return "Стык AB";
  }
  return `Кубок ${cup}`;
}

function roundTitle(round: number, total: number, isAb: boolean): string {
  if (isAb) {
    return "Стык";
  }
  const fromEnd = total - round;
  if (fromEnd === 0) return "Финал";
  if (fromEnd === 1) return "1/2";
  if (fromEnd === 2) return "1/4";
  if (fromEnd === 3) return "1/8";
  return `Раунд ${round}`;
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
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "1400px";
  iframe.style.height = "900px";
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
    @page { size: landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; font-size: 12px; color: #111; margin: 16px; }
    h1 { font-size: 16px; margin: 0 0 2px; }
    .meta { color: #555; margin: 0 0 12px; font-size: 11px; }
    .bracket { display: flex; align-items: flex-start; width: max-content; }
    .col { display: flex; flex-direction: column; padding-left: 40px; }
    .col-title { height: 14px; margin-bottom: 8px; text-align: center; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
    .col-body { position: relative; }
    .mc { position: absolute; left: 0; width: ${MATCH_W}px; height: ${MATCH_H}px; }
    .mc-stack { position: relative; width: ${MATCH_W}px; height: ${MATCH_H}px; margin-bottom: 12px; }
    .court { position: absolute; left: -40px; top: 50%; transform: translateY(-50%); width: 36px;
      text-align: center; font-size: 8px; color: #4b5563; line-height: 1.15; }
    .court strong { display: inline-block; margin-top: 2px; min-width: 28px; padding: 2px 0;
      border: 1.5px solid #f59e0b; background: #fffbeb; font-size: 11px; font-weight: 700; color: #78350f; }
    .box { display: flex; width: 100%; height: 100%; overflow: hidden; border: 1px solid #000; background: #fff; border-radius: 2px; }
    .names { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .row { flex: 1; display: flex; align-items: center; padding: 0 6px; min-height: 0; }
    .row + .row { border-top: 1px solid rgba(0,0,0,0.15); }
    .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-size: 10px; font-weight: 500; line-height: 1.2; }
    .name.tbd { font-style: italic; color: #9ca3af; font-weight: 400; }
    .scores { width: 28px; display: flex; flex-direction: column; border-left: 1px solid #000; }
    .sc { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; }
    .sc + .sc { border-top: 1px solid rgba(0,0,0,0.15); }
    .conn { position: relative; flex-shrink: 0; width: ${CONNECTOR_W}px; }
    .conn .h { position: absolute; left: 0; height: 2px; background: #000; }
    .conn .v { position: absolute; left: 50%; width: 2px; background: #000; }
    .place-label { position: absolute; left: 0; width: 100%; top: -14px; text-align: center;
      font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
    .place-card { position: absolute; left: 0; width: ${MATCH_W}px; height: ${MATCH_H}px;
      display: flex; align-items: center; }
    .place-box { width: 100%; height: 28px; display: flex; align-items: center; padding: 0 6px;
      border: 1px solid #000; background: #fff; border-radius: 2px; overflow: hidden; }
    .stack-col { display: flex; flex-direction: column; gap: 12px; width: ${MATCH_W}px; }
    @media print {
      body { margin: 8px; }
      .bracket { page-break-inside: avoid; }
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
  window.setTimeout(triggerPrint, 150);
}

function printMatchCardHtml(
  match: TournamentCupMatchView,
  absoluteTop: number | null
): string {
  const aName = teamLabel(match.team_a_players);
  const bName = teamLabel(match.team_b_players);
  const isTbdA = !match.team_a_id;
  const isTbdB = !match.team_b_id;
  const scoreA = match.score_a != null ? String(match.score_a) : "—";
  const scoreB = match.score_b != null ? String(match.score_b) : "—";
  const court = match.court != null ? String(match.court) : "—";
  const wrapClass = absoluteTop == null ? "mc-stack" : "mc";
  const style =
    absoluteTop == null ? "" : ` style="top:${absoluteTop}px"`;
  return `<div class="${wrapClass}"${style}>
    <div class="court">дорожка<br><strong>${escapeHtml(court)}</strong></div>
    <div class="box">
      <div class="names">
        <div class="row"><span class="name${isTbdA ? " tbd" : ""}">${escapeHtml(aName)}</span></div>
        <div class="row"><span class="name${isTbdB ? " tbd" : ""}">${escapeHtml(bName)}</span></div>
      </div>
      <div class="scores">
        <div class="sc">${scoreA}</div>
        <div class="sc">${scoreB}</div>
      </div>
    </div>
  </div>`;
}

function printPlaceCardHtml(
  players: string[] | null,
  absoluteTop: number | null,
  label?: string
): string {
  const isTbd = !players?.length;
  const name = isTbd ? "Будет определен" : teamLabel(players!);
  const style =
    absoluteTop == null ? "" : ` style="top:${absoluteTop}px"`;
  const labelHtml = label
    ? `<div class="place-label">${escapeHtml(label)}</div>`
    : "";
  if (absoluteTop == null) {
    return `<div class="mc-stack" style="height:auto;margin-bottom:12px">
      ${label ? `<div style="text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">${escapeHtml(label)}</div>` : ""}
      <div class="place-box"><span class="name${isTbd ? " tbd" : ""}">${escapeHtml(name)}</span></div>
    </div>`;
  }
  return `<div class="place-card"${style}>
    ${labelHtml}
    <div class="place-box"><span class="name${isTbd ? " tbd" : ""}">${escapeHtml(name)}</span></div>
  </div>`;
}

function printConnectorsHtml(
  roundIdx: number,
  pairCount: number,
  columnHeight: number
): string {
  const lines: string[] = [];
  for (let i = 0; i < pairCount; i++) {
    const y1 = matchCenterY(roundIdx, i * 2);
    const y2 = matchCenterY(roundIdx, i * 2 + 1);
    const mid = (y1 + y2) / 2;
    const top = Math.min(y1, y2);
    const height = Math.abs(y2 - y1);
    lines.push(
      `<div class="h" style="top:${y1 - 1}px;width:50%"></div>`,
      `<div class="h" style="top:${y2 - 1}px;width:50%"></div>`,
      `<div class="v" style="top:${top}px;height:${height}px"></div>`,
      `<div class="h" style="top:${mid - 1}px;left:50%;width:50%"></div>`
    );
  }
  return `<div class="conn" style="height:${columnHeight}px;margin-top:22px">${lines.join("")}</div>`;
}

function buildCupBracketPrintHtml(options: {
  tournamentName?: string;
  cupView: TournamentCupStageView;
}): string {
  const { tournamentName, cupView } = options;
  const isAb = cupView.cup === "AB";
  const title = cupTabLabel(cupView.cup);
  const third = cupView.matches.find((m) => m.is_third_place);
  const mainMatches = cupView.matches.filter((m) => !m.is_third_place);
  const byRound = new Map<number, TournamentCupMatchView[]>();
  for (const m of mainMatches) {
    if (!byRound.has(m.round_number)) {
      byRound.set(m.round_number, []);
    }
    byRound.get(m.round_number)!.push(m);
  }
  const rounds = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, matches]) => ({
      round,
      matches: matches.sort((a, b) => a.match_index - b.match_index),
    }));

  const firstCount = rounds[0]?.matches.length ?? 0;
  const lastRoundIdx = Math.max(0, rounds.length - 1);
  const finalMatch = rounds[lastRoundIdx]?.matches[0] ?? null;
  const useAbsolute = !isAb && firstCount > 1;
  const showPlaces = !isAb && finalMatch != null;
  const championPlayers = finalMatch ? matchWinnerPlayers(finalMatch) : null;
  const thirdPlayers = third ? matchWinnerPlayers(third) : null;

  const baseHeight = bracketColumnHeight(Math.max(firstCount, 1));
  const finalTop = useAbsolute ? matchTop(lastRoundIdx, 0) : 0;
  const thirdTop = finalTop + MATCH_H + ROUND_GAP * 2;
  const columnHeight =
    third && useAbsolute
      ? Math.max(baseHeight, thirdTop + MATCH_H)
      : baseHeight;

  let bracketInner = "";

  if (useAbsolute) {
    for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
      const { round, matches } = rounds[roundIdx];
      const pairCount = Math.max(1, Math.floor(matches.length / 2));
      const cards = matches
        .map((m, mi) => printMatchCardHtml(m, matchTop(roundIdx, mi)))
        .join("");

      let thirdBlock = "";
      if (roundIdx === lastRoundIdx && third) {
        thirdBlock = `<div class="mc" style="top:${thirdTop}px">
          <div class="place-label">За 3-е место</div>
          <div class="court">дорожка<br><strong>${escapeHtml(
            third.court != null ? String(third.court) : "—"
          )}</strong></div>
          <div class="box">
            <div class="names">
              <div class="row"><span class="name${!third.team_a_id ? " tbd" : ""}">${escapeHtml(teamLabel(third.team_a_players))}</span></div>
              <div class="row"><span class="name${!third.team_b_id ? " tbd" : ""}">${escapeHtml(teamLabel(third.team_b_players))}</span></div>
            </div>
            <div class="scores">
              <div class="sc">${third.score_a != null ? third.score_a : "—"}</div>
              <div class="sc">${third.score_b != null ? third.score_b : "—"}</div>
            </div>
          </div>
        </div>`;
      }

      bracketInner += `<div class="col">
        <div class="col-title">${escapeHtml(roundTitle(round, rounds.length, isAb))}</div>
        <div class="col-body" style="height:${columnHeight}px;width:${MATCH_W}px">${cards}${thirdBlock}</div>
      </div>`;

      if (roundIdx < rounds.length - 1) {
        bracketInner += printConnectorsHtml(roundIdx, pairCount, columnHeight);
      }
    }

    if (showPlaces) {
      const placeLines = [
        `<div class="h" style="top:${finalTop + MATCH_H / 2 - 1}px;width:100%"></div>`,
      ];
      if (third) {
        placeLines.push(
          `<div class="h" style="top:${thirdTop + MATCH_H / 2 - 1}px;width:100%"></div>`
        );
      }
      bracketInner += `<div class="conn" style="height:${columnHeight}px;margin-top:22px">${placeLines.join("")}</div>`;
      bracketInner += `<div class="col" style="padding-left:0">
        <div class="col-title"></div>
        <div class="col-body" style="height:${columnHeight}px;width:${MATCH_W}px">
          ${printPlaceCardHtml(championPlayers, finalTop)}
          ${third ? printPlaceCardHtml(thirdPlayers, thirdTop) : ""}
        </div>
      </div>`;
    }
  } else {
    // Стык AB или короткая сетка — колонки без абсолютного позиционирования
    for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
      const { round, matches } = rounds[roundIdx];
      const cards = matches.map((m) => printMatchCardHtml(m, null)).join("");
      let thirdBlock = "";
      if (roundIdx === lastRoundIdx && third) {
        thirdBlock = `<div style="margin-top:8px">
          <div style="text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">За 3-е место</div>
          ${printMatchCardHtml(third, null)}
        </div>`;
      }
      bracketInner += `<div class="col">
        <div class="col-title">${escapeHtml(roundTitle(round, rounds.length, isAb))}</div>
        <div class="stack-col">${cards}${thirdBlock}</div>
      </div>`;
      if (roundIdx < rounds.length - 1) {
        bracketInner += `<div style="width:${CONNECTOR_W}px;flex-shrink:0"></div>`;
      }
    }
    if (showPlaces) {
      bracketInner += `<div style="width:${CONNECTOR_W}px;flex-shrink:0"></div>`;
      bracketInner += `<div class="col" style="padding-left:0">
        <div class="col-title"></div>
        <div class="stack-col">
          ${printPlaceCardHtml(championPlayers, null)}
          ${third ? printPlaceCardHtml(thirdPlayers, null) : ""}
        </div>
      </div>`;
    }
  }

  return `
    <h1>${escapeHtml(title)}</h1>
    ${
      tournamentName
        ? `<p class="meta">${escapeHtml(tournamentName)}</p>`
        : ""
    }
    <div class="bracket">${bracketInner}</div>
  `;
}

/** Высота колонки раунда 1 при n матчах. */
function bracketColumnHeight(firstRoundMatchCount: number): number {
  if (firstRoundMatchCount <= 0) {
    return MATCH_H;
  }
  return firstRoundMatchCount * SLOT - ROUND_GAP;
}

const CupMatchCard: React.FC<{
  tournamentId?: number;
  match: TournamentCupMatchView;
  readOnly?: boolean;
}> = ({ tournamentId, match, readOnly }) => {
  const queryClient = useQueryClient();
  const hasSaved = match.score_a != null && match.score_b != null;
  const [locked, setLocked] = useState(hasSaved);
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

  const saveMutation = useMutation(
    async (
      payload:
        | { score_a: number; score_b: number }
        | { clear: true }
        | { court: number | null }
    ) => {
      if (tournamentId == null) {
        throw new Error("Не указан турнир");
      }
      const response = await adminApi.updateTournamentCupMatch(
        tournamentId,
        match.id,
        payload
      );
      if (!response.data.success) {
        throw new Error(response.data.message || "Не удалось сохранить");
      }
      return { data: response.data.data, payload };
    },
    {
      onSuccess: ({ data, payload }) => {
        if (tournamentId == null) {
          return;
        }
        if (data?.cups) {
          queryClient.setQueryData(
            ["tournamentInProgress", tournamentId],
            (old: unknown) => {
              if (!old || typeof old !== "object") {
                return old;
              }
              return {
                ...(old as object),
                cups: data.cups,
                ...(data.tournament ? { tournament: data.tournament } : {}),
              };
            }
          );
        }
        void queryClient.invalidateQueries([
          "tournamentInProgress",
          tournamentId,
        ]);
        if ("clear" in payload) {
          setLocked(false);
          setScoreA("");
          setScoreB("");
        } else if ("score_a" in payload) {
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
      if (hasSaved) {
        saveMutation.mutate({ clear: true });
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
    saveMutation.mutate({ score_a: a, score_b: b });
  };

  const saveCourt = () => {
    const raw = court.trim();
    if (raw === "") {
      if (match.court == null) return;
      saveMutation.mutate({ court: null });
      return;
    }
    const c = parseInt(raw, 10);
    if (!Number.isInteger(c) || c < 1 || c > 99) {
      toast.error("Номер дорожки должен быть от 1 до 99");
      setCourt(match.court != null ? String(match.court) : "");
      return;
    }
    if (c === match.court) return;
    saveMutation.mutate({ court: c });
  };

  const nameA = teamLabel(match.team_a_players);
  const nameB = teamLabel(match.team_b_players);
  const TBD = "Будет определен";
  const isTbdA = !match.team_a_id;
  const isTbdB = !match.team_b_id;
  const inputsDisabled =
    readOnly ||
    saveMutation.isLoading ||
    locked ||
    !match.team_a_id ||
    !match.team_b_id;

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
        className={`w-full bg-transparent text-center text-xs font-bold tabular-nums text-gray-900 outline-none focus:ring-1 focus:ring-gray-400/50 disabled:opacity-90 ${
          locked ? "text-emerald-700" : ""
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

  const courtLeft = (
    <div className="absolute -left-11 top-1/2 z-10 flex w-10 -translate-y-1/2 flex-col items-center gap-0.5">
      <span className="text-[9px] font-medium leading-none text-gray-600">
        дорожка
      </span>
      {readOnly ? (
        <span className="inline-flex h-7 w-10 items-center justify-center rounded border-2 border-amber-400 bg-amber-50 text-sm font-bold text-amber-950">
          {match.court != null ? match.court : "—"}
        </span>
      ) : (
        <input
          type="number"
          min={1}
          max={99}
          inputMode="numeric"
          className="h-7 w-10 rounded border-2 border-amber-400 bg-amber-50 px-0.5 text-center text-sm font-bold text-amber-950 shadow-sm outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
          value={court}
          disabled={saveMutation.isLoading}
          onChange={(e) => setCourt(e.target.value)}
          onBlur={saveCourt}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Номер дорожки"
          placeholder="№"
          title="Номер дорожки"
        />
      )}
    </div>
  );

  return (
    <div
      className="relative flex shrink-0"
      style={{ height: MATCH_H, width: MATCH_W }}
    >
      {courtLeft}
      <div className="relative flex h-full w-full overflow-hidden rounded border border-black bg-white">
        {/* Col 1: team names */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center border-b border-black/20 px-2">
            <span
              className={`min-w-0 flex-1 truncate text-[11px] leading-tight ${
                isTbdA ? "italic text-gray-400" : "font-medium text-gray-900"
              }`}
              title={nameA}
            >
              {isTbdA ? TBD : nameA}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center px-2">
            <span
              className={`min-w-0 flex-1 truncate text-[11px] leading-tight ${
                isTbdB ? "italic text-gray-400" : "font-medium text-gray-900"
              }`}
              title={nameB}
            >
              {isTbdB ? TBD : nameB}
            </span>
          </div>
        </div>

        {/* Col 2: scores */}
        <div className="flex w-7 shrink-0 flex-col border-l border-black bg-gray-100">
          <div className="flex min-h-0 flex-1 items-center justify-center border-b border-black/20 px-0.5">
            {renderScore("a", scoreA, match.score_a, nameA)}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-0.5">
            {renderScore("b", scoreB, match.score_b, nameB)}
          </div>
        </div>

        {/* Col 3: lock/edit spanning both rows */}
        {!readOnly && (
          <div className="flex w-7 shrink-0 items-center justify-center border-l border-black bg-gray-50">
            {!locked ? (
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
                disabled={
                  saveMutation.isLoading || !match.team_a_id || !match.team_b_id
                }
                onClick={lockScore}
                title="Зафиксировать счёт"
              >
                <CheckIcon className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                disabled={saveMutation.isLoading}
                onClick={() => setLocked(false)}
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
};

/** Карточка итога (победитель / 3-е) — только имя, в стиле строки пары. */
const CupPlaceCard: React.FC<{
  players: string[] | null;
}> = ({ players }) => {
  const isTbd = !players?.length;
  const name = isTbd ? "Будет определен" : teamLabel(players!);
  return (
    <div
      className="relative flex shrink-0 items-center"
      style={{ height: MATCH_H, width: MATCH_W }}
    >
      <div className="flex h-7 w-full items-center overflow-hidden rounded border border-black bg-white px-2">
        <span
          className={`min-w-0 truncate text-[11px] leading-tight ${
            isTbd ? "italic text-gray-400" : "font-medium text-gray-900"
          }`}
          title={name}
        >
          {name}
        </span>
      </div>
    </div>
  );
};

/** Горизонтальный соединитель от матча к карточке места. */
const PlaceConnector: React.FC<{ height?: number }> = ({
  height = MATCH_H,
}) => (
  <div
    className="relative shrink-0"
    style={{ width: CONNECTOR_W, height }}
  >
    <div
      className="absolute left-0 right-0 h-0.5 bg-black"
      style={{ top: height / 2 - 1 }}
    />
  </div>
);
const BracketConnectors: React.FC<{
  roundIdx: number;
  pairCount: number;
  columnHeight: number;
}> = ({ roundIdx, pairCount, columnHeight }) => {
  return (
    <div
      className="relative shrink-0"
      style={{ width: CONNECTOR_W, height: columnHeight }}
    >
      {Array.from({ length: pairCount }, (_, i) => {
        const y1 = matchCenterY(roundIdx, i * 2);
        const y2 = matchCenterY(roundIdx, i * 2 + 1);
        const mid = (y1 + y2) / 2;
        const line = "bg-black";
        return (
          <React.Fragment key={i}>
            <div
              className={`absolute h-0.5 ${line}`}
              style={{ top: y1 - 1, left: 0, width: "50%" }}
            />
            <div
              className={`absolute h-0.5 ${line}`}
              style={{ top: y2 - 1, left: 0, width: "50%" }}
            />
            <div
              className={`absolute w-0.5 ${line}`}
              style={{
                top: Math.min(y1, y2),
                left: "50%",
                height: Math.abs(y2 - y1),
              }}
            />
            <div
              className={`absolute h-0.5 ${line}`}
              style={{ top: mid - 1, left: "50%", width: "50%" }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};

const CupBracketPanel: React.FC<{
  tournamentId?: number;
  cupView: TournamentCupStageView;
  readOnly?: boolean;
}> = ({ tournamentId, cupView, readOnly }) => {
  const third = cupView.matches.find((m) => m.is_third_place);
  const isAb = cupView.cup === "AB";

  const rounds = useMemo(() => {
    const mainMatches = cupView.matches.filter((m) => !m.is_third_place);
    const map = new Map<number, TournamentCupMatchView[]>();
    for (const m of mainMatches) {
      if (!map.has(m.round_number)) {
        map.set(m.round_number, []);
      }
      map.get(m.round_number)!.push(m);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([round, matches]) => ({
        round,
        matches: matches.sort((a, b) => a.match_index - b.match_index),
      }));
  }, [cupView.matches]);

  const firstCount = rounds[0]?.matches.length ?? 0;
  const lastRoundIdx = Math.max(0, rounds.length - 1);
  const finalMatch = rounds[lastRoundIdx]?.matches[0] ?? null;
  const useAbsolute = !isAb && firstCount > 1;
  const showPlaces = !isAb && finalMatch != null;
  const championPlayers = finalMatch ? matchWinnerPlayers(finalMatch) : null;
  const thirdPlayers = third ? matchWinnerPlayers(third) : null;

  const baseHeight = bracketColumnHeight(Math.max(firstCount, 1));
  const finalTop = useAbsolute ? matchTop(lastRoundIdx, 0) : 0;
  const thirdTop = finalTop + MATCH_H + ROUND_GAP * 2;
  const columnHeight =
    third && useAbsolute
      ? Math.max(baseHeight, thirdTop + MATCH_H)
      : baseHeight;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50/80 p-3">
      <div className="flex min-w-max items-start gap-0 pb-1">
        {rounds.map(({ round, matches }, roundIdx) => {
          const slotCount = matches.length;
          const pairCount = Math.max(1, Math.floor(slotCount / 2));

          return (
            <React.Fragment key={round}>
              <div className="flex flex-col pl-12">
                <p className="mb-2 h-3.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {roundTitle(round, rounds.length, isAb)}
                </p>
                {useAbsolute ? (
                  <div
                    className="relative"
                    style={{
                      height: columnHeight,
                      width: MATCH_W,
                    }}
                  >
                    {matches.map((m, mi) => (
                      <div
                        key={m.id}
                        className="absolute left-0"
                        style={{ top: matchTop(roundIdx, mi) }}
                      >
                        <CupMatchCard
                          tournamentId={tournamentId}
                          match={m}
                          readOnly={readOnly}
                        />
                      </div>
                    ))}
                    {roundIdx === lastRoundIdx && third && (
                      <div
                        className="absolute left-0"
                        style={{ top: thirdTop }}
                      >
                        <p className="absolute -top-4 left-0 w-full text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          За 3-е место
                        </p>
                        <CupMatchCard
                          tournamentId={tournamentId}
                          match={third}
                          readOnly={readOnly}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3" style={{ width: MATCH_W }}>
                    {matches.map((m) => (
                      <CupMatchCard
                        key={m.id}
                        tournamentId={tournamentId}
                        match={m}
                        readOnly={readOnly}
                      />
                    ))}
                    {roundIdx === lastRoundIdx && third && (
                      <div>
                        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                          За 3-е место
                        </p>
                        <CupMatchCard
                          tournamentId={tournamentId}
                          match={third}
                          readOnly={readOnly}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
              {roundIdx < rounds.length - 1 && useAbsolute && (
                <div className="flex flex-col pt-5">
                  <BracketConnectors
                    roundIdx={roundIdx}
                    pairCount={pairCount}
                    columnHeight={columnHeight}
                  />
                </div>
              )}
              {roundIdx < rounds.length - 1 && !useAbsolute && (
                <div style={{ width: CONNECTOR_W }} />
              )}
            </React.Fragment>
          );
        })}

        {showPlaces && (
          <>
            <div className="flex flex-col pt-5">
              {useAbsolute ? (
                <div
                  className="relative"
                  style={{ width: CONNECTOR_W, height: columnHeight }}
                >
                  <div
                    className="absolute left-0 right-0 h-0.5 bg-black"
                    style={{ top: finalTop + MATCH_H / 2 - 1 }}
                  />
                  {third && (
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-black"
                      style={{ top: thirdTop + MATCH_H / 2 - 1 }}
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col">
                  <PlaceConnector />
                  {third && (
                    <>
                      <div style={{ height: ROUND_GAP + 24 }} />
                      <PlaceConnector />
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col pl-0">
              <p className="mb-2 h-3.5" aria-hidden />
              {useAbsolute ? (
                <div
                  className="relative"
                  style={{ height: columnHeight, width: MATCH_W }}
                >
                  <div
                    className="absolute left-0"
                    style={{ top: finalTop }}
                  >
                    <CupPlaceCard players={championPlayers} />
                  </div>
                  {third && (
                    <div
                      className="absolute left-0"
                      style={{ top: thirdTop }}
                    >
                      <CupPlaceCard players={thirdPlayers} />
                    </div>
                  )}
                </div>
              ) : (
                  <div className="flex flex-col gap-3" style={{ width: MATCH_W }}>
                  <CupPlaceCard players={championPlayers} />
                  {third && <CupPlaceCard players={thirdPlayers} />}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const TournamentCupStageResults: React.FC<Props> = ({
  tournamentId,
  cups,
  readOnly = false,
  showPrint = false,
  tournamentName,
  defaultCollapsed = false,
}) => {
  const sorted = useMemo(() => {
    const order: CupBracketCode[] = ["AB", "A", "B", "C", "D"];
    return [...cups].sort(
      (a, b) => order.indexOf(a.cup) - order.indexOf(b.cup)
    );
  }, [cups]);

  const [sectionOpen, setSectionOpen] = useState(!defaultCollapsed);
  const [activeCup, setActiveCup] = useState<CupBracketCode | null>(null);
  const selected =
    activeCup && sorted.some((c) => c.cup === activeCup)
      ? activeCup
      : sorted[0]?.cup ?? null;
  const active = sorted.find((c) => c.cup === selected);

  const printActiveCup = () => {
    if (!active) {
      return;
    }
    const title = cupTabLabel(active.cup);
    openPrintWindow(
      tournamentName ? `${tournamentName} — ${title}` : title,
      buildCupBracketPrintHtml({
        tournamentName,
        cupView: active,
      })
    );
  };

  if (!sorted.length) {
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
        <h2 className="text-lg font-semibold text-gray-900">Финал</h2>
        {sectionOpen ? (
          <ChevronUpIcon className="h-5 w-5 shrink-0 text-gray-500" />
        ) : (
          <ChevronDownIcon className="h-5 w-5 shrink-0 text-gray-500" />
        )}
      </button>

      {sectionOpen && (
        <div className="space-y-4 border-t border-gray-200 px-6 py-4">
          {showPrint && active && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                onClick={printActiveCup}
              >
                <PrinterIcon className="h-4 w-4" aria-hidden />
                Печать
              </button>
            </div>
          )}
          <div
            className="flex flex-wrap gap-1 border-b border-gray-200"
            role="tablist"
          >
            {sorted.map((c) => {
              const isActive = c.cup === selected;
              return (
                <button
                  key={c.cup}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "border-primary-600 text-primary-700"
                      : "border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900"
                  }`}
                  onClick={() => setActiveCup(c.cup)}
                >
                  {cupTabLabel(c.cup)}
                </button>
              );
            })}
          </div>
          {active && (
            <div role="tabpanel" className="pt-2">
              <CupBracketPanel
                tournamentId={tournamentId}
                cupView={active}
                readOnly={readOnly}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TournamentCupStageResults;
