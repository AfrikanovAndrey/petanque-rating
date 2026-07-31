import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useMutation } from "react-query";
import { adminApi } from "../../services/api";
import { handleApiError } from "../../utils";
import { getGroupLetter } from "../../utils/tournamentPlaySettings";

const SIZE_OPTIONS = [0, 2, 4, 8, 16] as const;
const A_OPTIONS = [2, 4, 8, 16] as const;

export type CupQualificationCandidate = {
  team_id: number;
  players: string[];
  /** 0 — швейцарка (одна корзина) */
  group_number: number;
  place: number;
  wins: number;
  point_diff: number;
  points_for: number;
};

type AllocationMode = "auto" | "manual";
type CupPoolKey = "AB" | "A" | "B" | "C" | "D";
type ManualPools = Partial<Record<CupPoolKey, number[]>>;

type Props = {
  open: boolean;
  onClose: () => void;
  tournamentId: number;
  availableTeams: number;
  /** Команды с местами после групп/швейцарки (для ручного распределения) */
  candidates: CupQualificationCandidate[];
  /** Ручной режим доступен (сейчас — после групп) */
  allowManual: boolean;
  onSuccess: () => void;
};

function compareCandidates(
  a: CupQualificationCandidate,
  b: CupQualificationCandidate
): number {
  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }
  if (b.point_diff !== a.point_diff) {
    return b.point_diff - a.point_diff;
  }
  if (b.points_for !== a.points_for) {
    return b.points_for - a.points_for;
  }
  return a.team_id - b.team_id;
}

/** Лента квалификации как на бэкенде: все 1-е, затем лучшие 2-е, … */
function rankCandidates(
  candidates: CupQualificationCandidate[]
): CupQualificationCandidate[] {
  const byPlace = new Map<number, CupQualificationCandidate[]>();
  for (const t of candidates) {
    if (t.place <= 0) {
      continue;
    }
    if (!byPlace.has(t.place)) {
      byPlace.set(t.place, []);
    }
    byPlace.get(t.place)!.push(t);
  }
  const places = [...byPlace.keys()].sort((a, b) => a - b);
  const ranked: CupQualificationCandidate[] = [];
  for (const place of places) {
    const pool = byPlace.get(place)!;
    pool.sort(compareCandidates);
    ranked.push(...pool);
  }
  return ranked;
}

function autoAllocateIds(
  ranked: CupQualificationCandidate[],
  sizes: { a: number; b: number; c: number; d: number; abPlayoff: boolean }
): ManualPools {
  let offset = 0;
  const take = (n: number) => {
    const ids = ranked.slice(offset, offset + n).map((t) => t.team_id);
    offset += n;
    while (ids.length < n) {
      ids.push(0);
    }
    return ids;
  };

  if (sizes.abPlayoff) {
    return {
      AB: take(16),
      C: take(sizes.c),
      D: take(sizes.d),
    };
  }
  return {
    A: take(sizes.a),
    B: take(sizes.b),
    C: take(sizes.c),
    D: take(sizes.d),
  };
}

function emptySlots(n: number): number[] {
  return Array.from({ length: n }, () => 0);
}

function candidateLabel(c: CupQualificationCandidate): string {
  const place = `${c.place} место`;
  const group =
    c.group_number > 0
      ? `Гр. ${getGroupLetter(c.group_number)}, ${place}`
      : place;
  return `${group} — ${c.players.join(", ") || `Команда #${c.team_id}`}`;
}

const CupStageStartModal: React.FC<Props> = ({
  open,
  onClose,
  tournamentId,
  availableTeams,
  candidates,
  allowManual,
  onSuccess,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<AllocationMode>("auto");
  const [a, setA] = useState(8);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);
  const [d, setD] = useState(0);
  const [abPlayoff, setAbPlayoff] = useState(false);
  const [thirdPlaceB, setThirdPlaceB] = useState(true);
  const [thirdPlaceC, setThirdPlaceC] = useState(true);
  const [thirdPlaceD, setThirdPlaceD] = useState(true);
  const [manualPools, setManualPools] = useState<ManualPools>({});

  useEffect(() => {
    if (open) {
      setStep(1);
      setMode("auto");
      setA(8);
      setB(0);
      setC(0);
      setD(0);
      setAbPlayoff(false);
      setThirdPlaceB(true);
      setThirdPlaceC(true);
      setThirdPlaceD(true);
      setManualPools({});
    }
  }, [open]);

  useEffect(() => {
    if (abPlayoff) {
      setA(8);
      setB(8);
    }
  }, [abPlayoff]);

  useEffect(() => {
    if (!allowManual && mode === "manual") {
      setMode("auto");
      setStep(1);
    }
  }, [allowManual, mode]);

  const ranked = useMemo(() => rankCandidates(candidates), [candidates]);

  const needed = useMemo(() => {
    if (abPlayoff) {
      return 16 + c + d;
    }
    return a + b + c + d;
  }, [a, b, c, d, abPlayoff]);

  const cupRows = useMemo(
    () =>
      [
        {
          cup: "A" as const,
          size: a,
          setSize: setA,
          required: true,
          thirdChecked: true,
          setThird: null as ((v: boolean) => void) | null,
          thirdFixed: true,
        },
        {
          cup: "B" as const,
          size: b,
          setSize: setB,
          required: false,
          thirdChecked: thirdPlaceB,
          setThird: setThirdPlaceB,
          thirdFixed: false,
        },
        {
          cup: "C" as const,
          size: c,
          setSize: setC,
          required: false,
          thirdChecked: thirdPlaceC,
          setThird: setThirdPlaceC,
          thirdFixed: false,
        },
        {
          cup: "D" as const,
          size: d,
          setSize: setD,
          required: false,
          thirdChecked: thirdPlaceD,
          setThird: setThirdPlaceD,
          thirdFixed: false,
        },
      ] as const,
    [a, b, c, d, thirdPlaceB, thirdPlaceC, thirdPlaceD]
  );

  const poolSections = useMemo(() => {
    if (abPlayoff) {
      return [
        { key: "AB" as const, title: "Стык AB", size: 16 },
        { key: "C" as const, title: "Кубок C", size: c },
        { key: "D" as const, title: "Кубок D", size: d },
      ].filter((s) => s.size > 0);
    }
    return [
      { key: "A" as const, title: "Кубок A", size: a },
      { key: "B" as const, title: "Кубок B", size: b },
      { key: "C" as const, title: "Кубок C", size: c },
      { key: "D" as const, title: "Кубок D", size: d },
    ].filter((s) => s.size > 0);
  }, [a, b, c, d, abPlayoff]);

  const assignedIds = useMemo(() => {
    const ids = new Set<number>();
    for (const section of poolSections) {
      for (const id of manualPools[section.key] ?? []) {
        if (id > 0) {
          ids.add(id);
        }
      }
    }
    return ids;
  }, [manualPools, poolSections]);

  const isManualComplete = useMemo(() => {
    if (needed < 2 || needed > availableTeams) {
      return false;
    }
    for (const section of poolSections) {
      const slots = manualPools[section.key] ?? [];
      if (slots.length !== section.size) {
        return false;
      }
      if (slots.some((id) => id <= 0)) {
        return false;
      }
    }
    return assignedIds.size === needed;
  }, [
    poolSections,
    manualPools,
    needed,
    availableTeams,
    assignedIds.size,
  ]);

  const mutation = useMutation(
    (payload: { manual_pools?: ManualPools }) =>
      adminApi.startCupStage(tournamentId, {
        a,
        b,
        c,
        d,
        ab_playoff: abPlayoff,
        third_place: {
          A: true,
          B: b >= 4 ? thirdPlaceB : false,
          C: c >= 4 ? thirdPlaceC : false,
          D: d >= 4 ? thirdPlaceD : false,
        },
        ...payload,
      }),
    {
      onSuccess: (res) => {
        if (res.data.success) {
          toast.success("Финал начат");
          onSuccess();
          onClose();
        } else {
          toast.error(res.data.message || "Не удалось начать финал");
        }
      },
      onError: (e) => {
        toast.error(handleApiError(e));
      },
    }
  );

  const initManualFromAuto = () => {
    setManualPools(autoAllocateIds(ranked, { a, b, c, d, abPlayoff }));
  };

  const goToManualStep = () => {
    if (needed > availableTeams || needed < 2) {
      toast.error("Проверьте размеры кубков");
      return;
    }
    if (ranked.length < needed) {
      toast.error("Недостаточно команд с местами для выбранных кубков");
      return;
    }
    initManualFromAuto();
    setStep(2);
  };

  const setSlot = (pool: CupPoolKey, index: number, teamId: number) => {
    setManualPools((prev) => {
      const size =
        poolSections.find((s) => s.key === pool)?.size ??
        (prev[pool]?.length ?? 0);
      const slots = [...(prev[pool] ?? emptySlots(size))];
      while (slots.length < size) {
        slots.push(0);
      }
      slots[index] = teamId;
      return { ...prev, [pool]: slots.slice(0, size) };
    });
  };

  const optionsForSlot = (pool: CupPoolKey, index: number) => {
    const current = manualPools[pool]?.[index] ?? 0;
    return ranked.filter(
      (t) => t.team_id === current || !assignedIds.has(t.team_id)
    );
  };

  const startAuto = () => {
    mutation.mutate({});
  };

  const startManual = () => {
    if (!isManualComplete) {
      toast.error("Заполните все слоты кубков");
      return;
    }
    const payload: ManualPools = {};
    for (const section of poolSections) {
      payload[section.key] = [...(manualPools[section.key] ?? [])];
    }
    mutation.mutate({ manual_pools: payload });
  };

  if (!open) {
    return null;
  }

  const configOk = needed <= availableTeams && needed >= 2;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className={`w-full rounded-xl bg-white shadow-xl ${
          step === 2 ? "max-w-3xl" : "max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {step === 1
              ? "Начать финальную часть"
              : "Ручное распределение по кубкам"}
          </h2>
          <button
            type="button"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Закрыть"
            disabled={mutation.isLoading}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {step === 1 ? (
          <div className="space-y-4 px-5 py-4 text-sm">
            <p className="text-gray-600">
              Доступно команд с местами: <strong>{availableTeams}</strong>.
              Размеры сеток — степени двойки.
            </p>

            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-600">
                    <th className="border-b border-gray-200 px-3 py-2 font-medium">
                      Кубок
                    </th>
                    <th className="border-b border-gray-200 px-3 py-2 font-medium">
                      Команд
                    </th>
                    <th className="border-b border-gray-200 px-3 py-2 font-medium">
                      Игра за 3 место
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cupRows.map((row) => {
                    const sizeDisabled =
                      abPlayoff && (row.cup === "A" || row.cup === "B");
                    const thirdEnabled = row.size >= 4;
                    const options = row.required ? A_OPTIONS : SIZE_OPTIONS;
                    return (
                      <tr key={row.cup} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-900">
                          Кубок {row.cup}
                          {row.required ? (
                            <span className="text-gray-400"> *</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="rounded-md border border-gray-300 px-2 py-1.5"
                            value={row.size}
                            disabled={sizeDisabled}
                            aria-label={`Число команд кубка ${row.cup}`}
                            onChange={(e) =>
                              row.setSize(Number(e.target.value))
                            }
                          >
                            {options.map((n) => (
                              <option key={n} value={n}>
                                {n === 0 ? "Выкл." : n}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          {row.thirdFixed ? (
                            <label className="inline-flex items-center gap-2 text-gray-700">
                              <input
                                type="checkbox"
                                checked={thirdEnabled}
                                disabled
                                readOnly
                                aria-label={`Игра за 3 место, кубок ${row.cup}`}
                              />
                              <span className="text-xs text-gray-500">
                                всегда
                              </span>
                            </label>
                          ) : (
                            <input
                              type="checkbox"
                              checked={thirdEnabled && row.thirdChecked}
                              disabled={!thirdEnabled || row.setThird == null}
                              aria-label={`Игра за 3 место, кубок ${row.cup}`}
                              onChange={(e) =>
                                row.setThird?.(e.target.checked)
                              }
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <label className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={abPlayoff}
                onChange={(e) => setAbPlayoff(e.target.checked)}
                disabled={availableTeams < 16}
              />
              <span>
                <span className="font-medium text-gray-900">
                  Стыковая игра AB
                </span>
                <span className="mt-0.5 block text-gray-600">
                  16 лучших → 8 матчей; победители в A, проигравшие в B (требует
                  A=8 и B=8).
                </span>
              </span>
            </label>

            {allowManual && (
              <div className="space-y-2">
                <p className="font-medium text-gray-900">Распределение команд</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      mode === "auto"
                        ? "border-primary-500 bg-primary-50 text-primary-900"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setMode("auto")}
                  >
                    Автоматически
                  </button>
                  <button
                    type="button"
                    className={`rounded-md border px-3 py-2 text-sm font-medium ${
                      mode === "manual"
                        ? "border-primary-500 bg-primary-50 text-primary-900"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                    onClick={() => setMode("manual")}
                  >
                    Вручную
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {mode === "auto"
                    ? "По местам в группах: сначала все 1-е, затем лучшие 2-е и т.д."
                    : "Слоты кубков и порядок посева задаёте сами (можно править автозаполнение)."}
                </p>
              </div>
            )}

            <p
              className={`text-sm ${
                needed > availableTeams ? "text-red-600" : "text-gray-500"
              }`}
            >
              Будет отобрано команд: {needed}
              {needed > availableTeams ? " — больше, чем доступно" : ""}
            </p>
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4 text-sm">
            <p className="text-gray-600">
              Порядок в кубке = посев (сид 1 сверху). Назначено:{" "}
              {assignedIds.size} из {needed}. Уже выбранные команды скрываются
              из остальных списков.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {poolSections.map((section) => {
                const slots =
                  manualPools[section.key] ?? emptySlots(section.size);
                return (
                  <div
                    key={section.key}
                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                  >
                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                      {section.title}
                      <span className="ml-1 font-normal text-gray-500">
                        ({section.size})
                      </span>
                    </h3>
                    <ol className="space-y-2">
                      {slots.map((teamId, index) => (
                        <li key={`${section.key}-${index}`} className="flex gap-2">
                          <span className="mt-2 w-6 shrink-0 text-xs text-gray-500">
                            {index + 1}.
                          </span>
                          <select
                            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                            value={teamId || ""}
                            aria-label={`${section.title}, сид ${index + 1}`}
                            onChange={(e) =>
                              setSlot(
                                section.key,
                                index,
                                Number(e.target.value) || 0
                              )
                            }
                          >
                            <option value="">— выберите —</option>
                            {optionsForSlot(section.key, index).map((t) => (
                              <option key={t.team_id} value={t.team_id}>
                                {candidateLabel(t)}
                              </option>
                            ))}
                          </select>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          {step === 2 ? (
            <button
              type="button"
              className="mr-auto rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              disabled={mutation.isLoading}
              onClick={() => setStep(1)}
            >
              Назад
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            disabled={mutation.isLoading}
          >
            Отмена
          </button>
          {step === 1 && mode === "manual" && allowManual ? (
            <button
              type="button"
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              disabled={!configOk}
              onClick={goToManualStep}
            >
              Далее
            </button>
          ) : step === 1 ? (
            <button
              type="button"
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              disabled={mutation.isLoading || !configOk}
              onClick={startAuto}
            >
              {mutation.isLoading ? "Создание…" : "Начать финал"}
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              disabled={mutation.isLoading || !isManualComplete}
              onClick={startManual}
            >
              {mutation.isLoading ? "Создание…" : "Начать финал"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CupStageStartModal;
