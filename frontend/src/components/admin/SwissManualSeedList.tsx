import { Bars2Icon } from "@heroicons/react/24/outline";
import React, { useCallback, useRef, useState } from "react";
import { moveItem } from "../../utils/swissSeed";

export type SwissManualSeedRow = {
  team_id: number;
  name: string;
  rating: number;
};

type Props = {
  items: SwissManualSeedRow[];
  disabled?: boolean;
  onReorder: (teamIds: number[]) => void;
};

function indexFromPointer(clientX: number, clientY: number): number | null {
  const el = document.elementFromPoint(clientX, clientY);
  const row = el?.closest("[data-seed-index]");
  if (!row) {
    return null;
  }
  const idx = Number(row.getAttribute("data-seed-index"));
  return Number.isFinite(idx) ? idx : null;
}

const SwissManualSeedList: React.FC<Props> = ({
  items,
  disabled = false,
  onReorder,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const pointerDragIndexRef = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);

  const clearDrag = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
    pointerDragIndexRef.current = null;
    activePointerIdRef.current = null;
  }, []);

  const handleDropAt = useCallback(
    (toIndex: number) => {
      const fromIndex = pointerDragIndexRef.current ?? dragIndex;
      if (fromIndex == null || disabled) {
        clearDrag();
        return;
      }
      onReorder(moveItem(items, fromIndex, toIndex).map((row) => row.team_id));
      clearDrag();
    },
    [clearDrag, disabled, dragIndex, items, onReorder]
  );

  const updateDropTarget = useCallback(
    (clientX: number, clientY: number) => {
      const index = indexFromPointer(clientX, clientY);
      if (index == null) {
        return;
      }
      setDragOverIndex((prev) => (prev === index ? prev : index));
    },
    []
  );

  const handleHandlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (disabled) {
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    pointerDragIndexRef.current = index;
    setDragIndex(index);
    setDragOverIndex(index);
  };

  const handleHandlePointerMove = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (
      disabled ||
      activePointerIdRef.current == null ||
      event.pointerId !== activePointerIdRef.current
    ) {
      return;
    }
    event.preventDefault();
    updateDropTarget(event.clientX, event.clientY);
  };

  const handleHandlePointerUp = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (
      activePointerIdRef.current == null ||
      event.pointerId !== activePointerIdRef.current
    ) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const toIndex =
      indexFromPointer(event.clientX, event.clientY) ??
      dragOverIndex ??
      pointerDragIndexRef.current;
    if (toIndex != null) {
      handleDropAt(toIndex);
    } else {
      clearDrag();
    }
  };

  const handleHandlePointerCancel = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    clearDrag();
  };

  return (
    <ul className="max-h-80 select-none space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
      {items.map((item, index) => {
        const isDragging = dragIndex === index;
        const isDropTarget =
          dragOverIndex === index && dragIndex != null && dragIndex !== index;
        return (
          <li
            key={item.team_id}
            data-seed-index={index}
            draggable={!disabled}
            onDragStart={(event) => {
              if (disabled) {
                event.preventDefault();
                return;
              }
              setDragIndex(index);
              pointerDragIndexRef.current = index;
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(item.team_id));
            }}
            onDragOver={(event) => {
              if (disabled || dragIndex == null) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (dragOverIndex !== index) {
                setDragOverIndex(index);
              }
            }}
            onDragLeave={() => {
              if (dragOverIndex === index) {
                setDragOverIndex(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleDropAt(index);
            }}
            onDragEnd={clearDrag}
            className={`flex items-center gap-2 rounded-md border bg-white px-2 py-2 text-sm shadow-sm ${
              isDragging ? "opacity-50" : ""
            } ${
              isDropTarget
                ? "border-primary-500 ring-1 ring-primary-500"
                : "border-gray-200"
            } ${disabled ? "cursor-default opacity-70" : ""}`}
            aria-grabbed={isDragging}
            aria-label={`Сид ${index + 1}: ${item.name}, рейтинг ${item.rating}. Перетащите, чтобы изменить порядок.`}
          >
            <button
              type="button"
              disabled={disabled}
              className="-ml-1 shrink-0 touch-none rounded p-0.5 text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-default disabled:opacity-70 cursor-grab active:cursor-grabbing"
              aria-label={`Перетащить команду ${item.name}`}
              onPointerDown={(event) => handleHandlePointerDown(event, index)}
              onPointerMove={handleHandlePointerMove}
              onPointerUp={handleHandlePointerUp}
              onPointerCancel={handleHandlePointerCancel}
            >
              <Bars2Icon className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="w-14 shrink-0 font-medium text-gray-700">
              Сид {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-gray-900">
              {item.name}
            </span>
            <span className="shrink-0 tabular-nums text-gray-500">
              {item.rating}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default SwissManualSeedList;
