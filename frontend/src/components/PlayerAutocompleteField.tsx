import React, { useEffect, useRef, useState } from "react";
import { ratingApi } from "../services/api";
import { PlayerSearchResult } from "../types";

type Props = {
  label: string;
  gender?: "male" | "female";
  value: PlayerSearchResult | null;
  onChange: (player: PlayerSearchResult | null) => void;
  excludeIds?: number[];
  disabled?: boolean;
  error?: string;
};

export const PlayerAutocompleteField: React.FC<Props> = ({
  label,
  gender,
  value,
  onChange,
  excludeIds = [],
  disabled,
  error,
}) => {
  const [localInput, setLocalInput] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<PlayerSearchResult[]>([]);
  const [showList, setShowList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalInput(value?.name ?? "");
  }, [value?.id]);

  const excludeKey = excludeIds.slice().sort((a, b) => a - b).join(",");

  useEffect(() => {
    const q = localInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await ratingApi.searchPlayers({ q, gender, limit: 30 });
        if (!res.data.success || !Array.isArray(res.data.data)) {
          if (!cancelled) setSuggestions([]);
          return;
        }
        const ex = new Set(excludeIds);
        const list = res.data.data.filter((p) => !ex.has(p.id));
        if (!cancelled) {
          setSuggestions(list);
          setActiveIndex(0);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [localInput, gender, excludeKey]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setShowList(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleInputChange = (raw: string) => {
    setLocalInput(raw);
    setShowList(true);
    if (value && raw !== value.name) {
      onChange(null);
    }
    setActiveIndex(0);
  };

  const selectPlayer = (p: PlayerSearchResult) => {
    onChange(p);
    setLocalInput(p.name);
    setShowList(false);
    setSuggestions([]);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      if (value && localInput.trim() !== value.name.trim()) {
        onChange(null);
        setLocalInput("");
      } else if (!value && localInput.trim().length > 0) {
        setLocalInput("");
      }
      setShowList(false);
    }, 180);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = suggestions[activeIndex];
      if (p) selectPlayer(p);
    } else if (e.key === "Escape") {
      setShowList(false);
    }
  };

  const listOpen =
    showList && !disabled && suggestions.length > 0 && localInput.trim().length >= 2;

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="text"
        className={`mt-1 block w-full border rounded-md px-3 py-2 text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 ${
          value ? "border-green-600 bg-green-50/50" : "border-gray-300"
        } ${error ? "border-red-500" : ""}`}
        value={localInput}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => {
          if (localInput.trim().length >= 2 && suggestions.length > 0) {
            setShowList(true);
          }
        }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        autoComplete="off"
        placeholder="Не менее 2 букв, затем выбор из списка"
      />
      {loading && (
        <p className="mt-1 text-xs text-gray-500">Поиск…</p>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!value && localInput.trim().length >= 2 && (
        <p className="mt-1 text-xs text-amber-800">
          Выберите игрока из списка — произвольный ввод не принимается.
        </p>
      )}
      {listOpen && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((p, index) => (
            <div
              key={p.id}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === activeIndex
                  ? "bg-primary-100 text-primary-900"
                  : "hover:bg-gray-50 text-gray-900"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectPlayer(p)}
            >
              <span className="font-medium">{p.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
