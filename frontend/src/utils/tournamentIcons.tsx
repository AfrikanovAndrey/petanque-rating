import { UserIcon } from "@heroicons/react/24/outline";
import { TournamentType } from "../types";

// Функция для получения иконок типа турнира
export function getTournamentTypeIcons(type: TournamentType) {
  switch (type) {
    case TournamentType.TRIPLETTE:
      // 2 мужчины + 1 женщина
      return (
        <span className="flex items-center gap-0.5 ml-2" title="Триплеты">
          <UserIcon className="h-4 w-4 text-blue-600" />
          <UserIcon className="h-4 w-4 text-blue-600" />
          <UserIcon className="h-4 w-4 text-pink-600" />
        </span>
      );
    case TournamentType.DOUBLETTE_MALE:
      // 2 мужчины
      return (
        <span
          className="flex items-center gap-0.5 ml-2"
          title="Дуплеты мужские"
        >
          <UserIcon className="h-4 w-4 text-blue-600" />
          <UserIcon className="h-4 w-4 text-blue-600" />
        </span>
      );
    case TournamentType.DOUBLETTE_FEMALE:
      // 2 женщины
      return (
        <span
          className="flex items-center gap-0.5 ml-2"
          title="Дуплеты женские"
        >
          <UserIcon className="h-4 w-4 text-pink-600" />
          <UserIcon className="h-4 w-4 text-pink-600" />
        </span>
      );
    case TournamentType.DOUBLETTE_MIXT:
      // 1 мужчина + 1 женщина
      return (
        <span className="flex items-center gap-0.5 ml-2" title="Дуплеты микст">
          <UserIcon className="h-4 w-4 text-blue-600" />
          <UserIcon className="h-4 w-4 text-pink-600" />
        </span>
      );
    case TournamentType.TET_A_TET_MALE:
      // 1 мужчина
      return (
        <span
          className="flex items-center gap-0.5 ml-2"
          title="Тет-а-тет мужской"
        >
          <UserIcon className="h-4 w-4 text-blue-600" />
        </span>
      );
    case TournamentType.TET_A_TET_FEMALE:
      // 1 женщина
      return (
        <span
          className="flex items-center gap-0.5 ml-2"
          title="Тет-а-тет женский"
        >
          <UserIcon className="h-4 w-4 text-pink-600" />
        </span>
      );
    default:
      return null;
  }
}
