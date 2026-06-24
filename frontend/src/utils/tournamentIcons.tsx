import { UserIcon } from "@heroicons/react/24/outline";
import { TournamentType } from "../types";

export type TournamentTypeIconOptions = {
  /** Для кнопок фильтра: без отступа слева, цвета под фон */
  forFilter?: boolean;
  active?: boolean;
};

function iconClass(
  options: TournamentTypeIconOptions | undefined,
  variant: "neutral" | "male" | "female"
): string {
  const active = options?.active ?? false;
  if (active) {
    if (variant === "male") return "h-4 w-4 text-blue-200";
    if (variant === "female") return "h-4 w-4 text-pink-200";
    return "h-4 w-4 text-white";
  }
  if (variant === "male") return "h-4 w-4 text-blue-600";
  if (variant === "female") return "h-4 w-4 text-pink-600";
  return "h-4 w-4 text-gray-600";
}

function wrapClass(options?: TournamentTypeIconOptions): string {
  return options?.forFilter
    ? "inline-flex items-center gap-0.5"
    : "inline-flex items-center gap-0.5 ml-2";
}

// Функция для получения иконок типа турнира
export function getTournamentTypeIcons(
  type: TournamentType,
  options?: TournamentTypeIconOptions
) {
  switch (type) {
    case TournamentType.TRIPLETTE:
      return (
        <span className={wrapClass(options)} title="Триплеты">
          <UserIcon className={iconClass(options, "neutral")} />
          <UserIcon className={iconClass(options, "neutral")} />
          <UserIcon className={iconClass(options, "neutral")} />
        </span>
      );
    case TournamentType.DOUBLETTE_MALE:
      return (
        <span className={wrapClass(options)} title="Дуплеты мужские">
          <UserIcon className={iconClass(options, "male")} />
          <UserIcon className={iconClass(options, "male")} />
        </span>
      );
    case TournamentType.DOUBLETTE_FEMALE:
      return (
        <span className={wrapClass(options)} title="Дуплеты женские">
          <UserIcon className={iconClass(options, "female")} />
          <UserIcon className={iconClass(options, "female")} />
        </span>
      );
    case TournamentType.DOUBLETTE_MIXT:
      return (
        <span className={wrapClass(options)} title="Дуплеты микст">
          <UserIcon className={iconClass(options, "male")} />
          <UserIcon className={iconClass(options, "female")} />
        </span>
      );
    case TournamentType.DOUBLETTE_ANY:
      return (
        <span className={wrapClass(options)} title="Дуплеты смешанные">
          <UserIcon className={iconClass(options, "neutral")} />
          <UserIcon className={iconClass(options, "neutral")} />
        </span>
      );
    case TournamentType.TET_A_TET_MALE:
      return (
        <span className={wrapClass(options)} title="Тет-а-тет мужской">
          <UserIcon className={iconClass(options, "male")} />
        </span>
      );
    case TournamentType.TET_A_TET_FEMALE:
      return (
        <span className={wrapClass(options)} title="Тет-а-тет женский">
          <UserIcon className={iconClass(options, "female")} />
        </span>
      );
    default:
      return null;
  }
}
