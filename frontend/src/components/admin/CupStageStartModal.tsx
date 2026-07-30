import { XMarkIcon } from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import { useMutation } from "react-query";
import { adminApi } from "../../services/api";
import { handleApiError } from "../../utils";

const SIZE_OPTIONS = [0, 2, 4, 8, 16] as const;
const A_OPTIONS = [2, 4, 8, 16] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  tournamentId: number;
  availableTeams: number;
  onSuccess: () => void;
};

const CupStageStartModal: React.FC<Props> = ({
  open,
  onClose,
  tournamentId,
  availableTeams,
  onSuccess,
}) => {
  const [a, setA] = useState(8);
  const [b, setB] = useState(0);
  const [c, setC] = useState(0);
  const [d, setD] = useState(0);
  const [abPlayoff, setAbPlayoff] = useState(false);
  // Кубок A всегда с матчем за 3-е; B/C/D — по выбору (если сетка ≥ 4).
  const [thirdPlaceB, setThirdPlaceB] = useState(true);
  const [thirdPlaceC, setThirdPlaceC] = useState(true);
  const [thirdPlaceD, setThirdPlaceD] = useState(true);

  useEffect(() => {
    if (open) {
      setA(8);
      setB(0);
      setC(0);
      setD(0);
      setAbPlayoff(false);
      setThirdPlaceB(true);
      setThirdPlaceC(true);
      setThirdPlaceD(true);
    }
  }, [open]);

  useEffect(() => {
    if (abPlayoff) {
      setA(8);
      setB(8);
    }
  }, [abPlayoff]);

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

  const mutation = useMutation(
    () =>
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

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Начать финальную часть
          </h2>
          <button
            type="button"
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <p className="text-gray-600">
            Доступно команд с местами в группах:{" "}
            <strong>{availableTeams}</strong>. Размеры сеток — степени двойки.
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
                          onChange={(e) => row.setSize(Number(e.target.value))}
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
                            <span className="text-xs text-gray-500">всегда</span>
                          </label>
                        ) : (
                          <input
                            type="checkbox"
                            checked={thirdEnabled && row.thirdChecked}
                            disabled={!thirdEnabled || row.setThird == null}
                            aria-label={`Игра за 3 место, кубок ${row.cup}`}
                            onChange={(e) => row.setThird?.(e.target.checked)}
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

          <p
            className={`text-sm ${
              needed > availableTeams ? "text-red-600" : "text-gray-500"
            }`}
          >
            Будет отобрано команд: {needed}
            {needed > availableTeams ? " — больше, чем доступно" : ""}
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="button"
            className="rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            disabled={
              mutation.isLoading || needed > availableTeams || needed < 2
            }
            onClick={() => mutation.mutate()}
          >
            {mutation.isLoading ? "Создание…" : "Начать финал"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CupStageStartModal;
