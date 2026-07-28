import { CheckIcon, PencilIcon } from "@heroicons/react/24/outline";
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
};

const MATCH_H = 72;
const MATCH_W = 268;
const CONNECTOR_W = 36;
const ROUND_GAP = 20;
const SLOT = MATCH_H + ROUND_GAP;

function teamLabel(players: string[]): string {
  if (!players.length) {
    return "Будет определен";
  }
  return players.join(", ");
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
        <span className="w-full text-center text-sm font-bold tabular-nums text-gray-800">
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
        className={`w-full bg-transparent text-center text-sm font-bold tabular-nums text-gray-900 outline-none focus:ring-1 focus:ring-gray-400/50 disabled:opacity-90 ${
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
    <div className="absolute -left-14 top-1/2 z-10 flex w-12 -translate-y-1/2 flex-col items-center gap-0.5">
      <span className="text-[10px] font-medium leading-none text-gray-600">
        дорожка
      </span>
      {readOnly ? (
        <span className="inline-flex h-9 w-12 items-center justify-center rounded-md border-2 border-amber-400 bg-amber-50 text-base font-bold text-amber-950">
          {match.court != null ? match.court : "—"}
        </span>
      ) : (
        <input
          type="number"
          min={1}
          max={99}
          inputMode="numeric"
          className="h-9 w-12 rounded-md border-2 border-amber-400 bg-amber-50 px-1 text-center text-base font-bold text-amber-950 shadow-sm outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-60"
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
      <div className="relative flex h-full w-full overflow-hidden rounded border-2 border-black bg-white">
        {/* Col 1: team names */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center border-b border-black/20 px-2.5">
            <span
              className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${
                isTbdA ? "italic text-gray-400" : "font-medium text-gray-900"
              }`}
              title={nameA}
            >
              {isTbdA ? TBD : nameA}
            </span>
          </div>
          <div className="flex min-h-0 flex-1 items-center px-2.5">
            <span
              className={`min-w-0 flex-1 truncate text-[13px] leading-tight ${
                isTbdB ? "italic text-gray-400" : "font-medium text-gray-900"
              }`}
              title={nameB}
            >
              {isTbdB ? TBD : nameB}
            </span>
          </div>
        </div>

        {/* Col 2: scores */}
        <div className="flex w-9 shrink-0 flex-col border-l-2 border-black bg-gray-100">
          <div className="flex min-h-0 flex-1 items-center justify-center border-b border-black/20 px-0.5">
            {renderScore("a", scoreA, match.score_a, nameA)}
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-0.5">
            {renderScore("b", scoreB, match.score_b, nameB)}
          </div>
        </div>

        {/* Col 3: lock/edit spanning both rows */}
        {!readOnly && (
          <div className="flex w-9 shrink-0 items-center justify-center border-l-2 border-black bg-gray-50">
            {!locked ? (
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
                disabled={
                  saveMutation.isLoading || !match.team_a_id || !match.team_b_id
                }
                onClick={lockScore}
                title="Зафиксировать счёт"
              >
                <CheckIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
                disabled={saveMutation.isLoading}
                onClick={() => setLocked(false)}
                title="Изменить счёт"
              >
                <PencilIcon className="h-4 w-4" />
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
      <div className="flex h-9 w-full items-center overflow-hidden rounded border-2 border-black bg-white px-2.5">
        <span
          className={`min-w-0 truncate text-[13px] leading-tight ${
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
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-50/80 p-5">
      <div className="flex min-w-max items-start gap-0 pb-2">
        {rounds.map(({ round, matches }, roundIdx) => {
          const slotCount = matches.length;
          const pairCount = Math.max(1, Math.floor(slotCount / 2));

          return (
            <React.Fragment key={round}>
              <div className="flex flex-col pl-16">
                <p className="mb-3 h-4 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">
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
                  <div className="flex flex-col gap-5" style={{ width: MATCH_W }}>
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
                <div className="flex flex-col pt-7">
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
            <div className="flex flex-col pt-7">
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
              <p className="mb-3 h-4" aria-hidden />
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
                <div className="flex flex-col gap-5" style={{ width: MATCH_W }}>
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
}) => {
  const sorted = useMemo(() => {
    const order: CupBracketCode[] = ["AB", "A", "B", "C", "D"];
    return [...cups].sort(
      (a, b) => order.indexOf(a.cup) - order.indexOf(b.cup)
    );
  }, [cups]);

  const [activeCup, setActiveCup] = useState<CupBracketCode | null>(null);
  const selected =
    activeCup && sorted.some((c) => c.cup === activeCup)
      ? activeCup
      : sorted[0]?.cup ?? null;
  const active = sorted.find((c) => c.cup === selected);

  if (!sorted.length) {
    return null;
  }

  return (
    <div className="card space-y-4 p-6">
      <h2 className="text-lg font-semibold text-gray-900">Финал</h2>
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
  );
};

export default TournamentCupStageResults;
