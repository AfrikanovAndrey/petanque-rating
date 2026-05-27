import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import React, { useState } from "react";
import {
  TournamentCategory,
  TournamentStatus,
  TournamentType,
} from "../types";
import {
  cn,
  getTornamentCategoryText,
  getTournamentStatusText,
  getTournamentTypeIcons,
  getTournamentTypeText,
} from "../utils";
import {
  hasActiveTournamentFilters,
  TournamentListFilters,
  TOURNAMENT_FILTER_CATEGORY_OPTIONS,
  TOURNAMENT_FILTER_STATUS_OPTIONS,
  TOURNAMENT_FILTER_TYPE_OPTIONS,
} from "../utils/tournamentFiltersCookie";

interface TournamentListFiltersPanelProps {
  filters: TournamentListFilters;
  onChange: (filters: TournamentListFilters) => void;
  statusOptions?: readonly TournamentStatus[];
  panelId?: string;
  /** На узком экране — перенос вариантов и ширина блока по экрану (админка) */
  adaptOptionsToViewport?: boolean;
}

function optionsRowClassName(adaptOptionsToViewport: boolean): string {
  return cn(
    "flex gap-2",
    adaptOptionsToViewport ? "flex-wrap md:flex-nowrap" : "flex-nowrap"
  );
}

function toggleValue<T>(selected: T[], value: T): T[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

interface FilterGroupProps<T extends string> {
  title: string;
  options: readonly T[];
  selected: T[];
  getLabel: (value: T) => string;
  onToggle: (value: T) => void;
  adaptOptionsToViewport: boolean;
}

function FilterGroup<T extends string>({
  title,
  options,
  selected,
  getLabel,
  onToggle,
  adaptOptionsToViewport,
}: FilterGroupProps<T>) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        {title}
      </p>
      <div className={optionsRowClassName(adaptOptionsToViewport)}>
        {options.map((option) => {
          const isActive = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => onToggle(option)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap",
                isActive
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-gray-700 border-gray-300 hover:border-primary-300 hover:bg-primary-50"
              )}
            >
              {getLabel(option)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TournamentTypeFilterGroup({
  selected,
  onToggle,
  adaptOptionsToViewport,
}: {
  selected: TournamentType[];
  onToggle: (type: TournamentType) => void;
  adaptOptionsToViewport: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Тип турнира
      </p>
      <div className={optionsRowClassName(adaptOptionsToViewport)}>
        {TOURNAMENT_FILTER_TYPE_OPTIONS.map((type) => {
          const isActive = selected.includes(type);
          const label = getTournamentTypeText(type) ?? type;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={isActive}
              aria-label={label}
              title={label}
              onClick={() => onToggle(type)}
              className={cn(
                "shrink-0 inline-flex items-center justify-center p-2 rounded-lg border transition-colors",
                isActive
                  ? "bg-primary-600 border-primary-600"
                  : "bg-white border-gray-300 hover:border-primary-300 hover:bg-primary-50"
              )}
            >
              {getTournamentTypeIcons(type, { forFilter: true, active: isActive })}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function countSelectedFilters(filters: TournamentListFilters): number {
  return (
    filters.statuses.length + filters.types.length + filters.categories.length
  );
}

interface FilterGroupsProps {
  filters: TournamentListFilters;
  onChange: (filters: TournamentListFilters) => void;
  statusOptions: readonly TournamentStatus[];
  adaptOptionsToViewport: boolean;
}

function FilterGroups({
  filters,
  onChange,
  statusOptions,
  adaptOptionsToViewport,
}: FilterGroupsProps) {
  return (
    <>
      <FilterGroup<TournamentStatus>
        title="Статус"
        options={statusOptions}
        adaptOptionsToViewport={adaptOptionsToViewport}
        selected={filters.statuses}
        getLabel={(status) => getTournamentStatusText(status)}
        onToggle={(status) =>
          onChange({
            ...filters,
            statuses: toggleValue(filters.statuses, status),
          })
        }
      />

      <TournamentTypeFilterGroup
        selected={filters.types}
        adaptOptionsToViewport={adaptOptionsToViewport}
        onToggle={(type) =>
          onChange({
            ...filters,
            types: toggleValue(filters.types, type),
          })
        }
      />

      <FilterGroup<TournamentCategory>
        title="Категория"
        options={TOURNAMENT_FILTER_CATEGORY_OPTIONS}
        adaptOptionsToViewport={adaptOptionsToViewport}
        selected={filters.categories}
        getLabel={(category) => getTornamentCategoryText(category) ?? category}
        onToggle={(category) =>
          onChange({
            ...filters,
            categories: toggleValue(filters.categories, category),
          })
        }
      />
    </>
  );
}

const TournamentListFiltersPanel: React.FC<TournamentListFiltersPanelProps> = ({
  filters,
  onChange,
  statusOptions = TOURNAMENT_FILTER_STATUS_OPTIONS,
  panelId = "tournament-filters-panel",
  adaptOptionsToViewport = false,
}) => {
  const active = hasActiveTournamentFilters(filters);
  const selectedCount = countSelectedFilters(filters);
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        "grid grid-cols-1 bg-gray-100 rounded-lg border border-gray overflow-hidden",
        adaptOptionsToViewport
          ? "w-full max-w-full md:w-max md:max-w-full"
          : "w-max max-w-full"
      )}
    >
      <div
        className={cn(
          "col-start-1 row-start-1 relative z-10 flex w-full items-center gap-2 bg-gray-100 px-4 sm:px-5",
          isExpanded ? "py-3" : "py-2"
        )}
      >
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex flex-1 min-w-0 items-center gap-2 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          <h2 className="text-sm font-semibold text-gray-900 whitespace-nowrap">
            Фильтры
          </h2>
          {selectedCount > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-800">
              {selectedCount}
            </span>
          )}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => onChange({ statuses: [], types: [], categories: [] })}
            className="shrink-0 text-sm text-primary-600 hover:text-primary-800 font-medium whitespace-nowrap"
          >
            Сбросить
          </button>
        )}
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          aria-label={isExpanded ? "Свернуть фильтры" : "Развернуть фильтры"}
          onClick={() => setIsExpanded((prev) => !prev)}
          className="shrink-0 rounded-md p-0.5 text-gray-400 outline-none hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          {isExpanded ? (
            <ChevronUpIcon className="h-5 w-5" aria-hidden />
          ) : (
            <ChevronDownIcon className="h-5 w-5" aria-hidden />
          )}
        </button>
      </div>

      {!isExpanded && (
        <div
          aria-hidden
          className="col-start-1 row-start-1 h-0 overflow-hidden opacity-0 pointer-events-none select-none"
        >
          <div
            className={cn(
              "space-y-4 px-4 sm:px-5",
              adaptOptionsToViewport ? "w-full md:w-max" : "w-max"
            )}
          >
            <FilterGroups
              filters={filters}
              onChange={onChange}
              statusOptions={statusOptions}
              adaptOptionsToViewport={adaptOptionsToViewport}
            />
          </div>
        </div>
      )}

      {isExpanded && (
        <div
          id={panelId}
          className="col-start-1 row-start-2 min-w-0 space-y-4 border-t border-gray px-4 pb-4 pt-4 sm:px-5 sm:pb-5"
        >
          <FilterGroups
            filters={filters}
            onChange={onChange}
            statusOptions={statusOptions}
            adaptOptionsToViewport={adaptOptionsToViewport}
          />
        </div>
      )}
    </div>
  );
};

export default TournamentListFiltersPanel;
