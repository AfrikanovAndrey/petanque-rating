import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";
import React, { useEffect, useMemo, useState } from "react";

type RatingDatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  maxDate?: string;
  todayDate?: string;
  onSelectToday?: () => void;
  embedded?: boolean;
};

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

function parseYmd(s: string): { y: number; m: number; d: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d };
}

function toYmd(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const RatingDatePicker: React.FC<RatingDatePickerProps> = ({
  value,
  onChange,
  maxDate,
  todayDate,
  onSelectToday,
  embedded = false,
}) => {
  const selected = parseYmd(value);
  const [viewYear, setViewYear] = useState(selected.y);
  const [viewMonth, setViewMonth] = useState(selected.m);

  useEffect(() => {
    const p = parseYmd(value);
    setViewYear(p.y);
    setViewMonth(p.m);
  }, [value]);

  const { cells } = useMemo(() => {
    const dim = new Date(viewYear, viewMonth, 0).getDate();
    const weekday = (new Date(viewYear, viewMonth - 1, 1).getDay() + 6) % 7;
    const list: { key: string; date: string | null; day: number }[] = [];

    for (let i = 0; i < weekday; i++) {
      list.push({ key: `empty-${i}`, date: null, day: 0 });
    }
    for (let d = 1; d <= dim; d++) {
      const date = toYmd(viewYear, viewMonth, d);
      list.push({ key: date, date, day: d });
    }

    return { cells: list };
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const canGoNext = maxDate
    ? (() => {
        const maxParsed = parseYmd(maxDate);
        return (
          viewYear < maxParsed.y ||
          (viewYear === maxParsed.y && viewMonth < maxParsed.m)
        );
      })()
    : true;

  const isTodaySelected = todayDate != null && value === todayDate;

  return (
    <div
      className={
        embedded
          ? "bg-white"
          : "border border-gray-200 rounded-md p-3 bg-white"
      }
    >
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="p-1 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Предыдущий месяц"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <span className="text-sm font-medium text-gray-900">
          {MONTHS[viewMonth - 1]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          disabled={!canGoNext}
          className="p-1 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Следующий месяц"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((wd) => (
          <div
            key={wd}
            className="text-xs font-medium text-gray-500 py-1"
          >
            {wd}
          </div>
        ))}
        {cells.map((cell) => {
          if (!cell.date) {
            return <span key={cell.key} className="h-8" aria-hidden />;
          }

          const isSelected = cell.date === value;
          const isToday = todayDate != null && cell.date === todayDate;

          return (
            <button
              key={cell.key}
              type="button"
              disabled={maxDate != null && cell.date > maxDate}
              onClick={() => onChange(cell.date!)}
              className={`h-8 w-full text-sm rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:text-gray-300 disabled:cursor-not-allowed ${
                isSelected
                  ? "bg-blue-600 text-white font-semibold"
                  : isToday
                    ? "text-blue-700 font-semibold ring-2 ring-inset ring-blue-400 hover:bg-blue-50"
                    : "text-gray-900 hover:bg-gray-100"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>

      {onSelectToday && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onSelectToday}
            disabled={isTodaySelected}
            className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-default disabled:hover:bg-blue-50"
          >
            Сегодня
          </button>
        </div>
      )}
    </div>
  );
};

export default RatingDatePicker;
