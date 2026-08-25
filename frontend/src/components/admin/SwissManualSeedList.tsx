import { Bars2Icon } from "@heroicons/react/24/outline";
import React, { useState } from "react";
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

const SwissManualSeedList: React.FC<Props> = ({
  items,
  disabled = false,
  onReorder,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const clearDrag = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDropAt = (toIndex: number) => {
    if (dragIndex == null || disabled) {
      clearDrag();
      return;
    }
    onReorder(moveItem(items, dragIndex, toIndex).map((row) => row.team_id));
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
            draggable={!disabled}
            onDragStart={(event) => {
              if (disabled) {
                event.preventDefault();
                return;
              }
              setDragIndex(index);
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
            className={`flex cursor-grab items-center gap-2 rounded-md border bg-white px-2 py-2 text-sm shadow-sm active:cursor-grabbing ${
              isDragging ? "opacity-50" : ""
            } ${
              isDropTarget
                ? "border-primary-500 ring-1 ring-primary-500"
                : "border-gray-200"
            } ${disabled ? "cursor-default opacity-70" : ""}`}
            aria-grabbed={isDragging}
            aria-label={`Сид ${index + 1}: ${item.name}, рейтинг ${item.rating}. Перетащите, чтобы изменить порядок.`}
          >
            <Bars2Icon
              className="h-5 w-5 shrink-0 text-gray-400"
              aria-hidden="true"
            />
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
