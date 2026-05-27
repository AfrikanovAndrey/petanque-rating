import { Tournament, TournamentStatus } from "../types";

export function getTournamentYear(tournament: Tournament): number {
  return new Date(tournament.date).getFullYear();
}

export type BuildYearTabsOptions = {
  /** Для админки: вкладка следующего года, если есть любые турниры (в т.ч. черновики) */
  includeNextYearWhenHasTournaments?: boolean;
};

/** Вкладки: следующий год (при открытой регистрации) → текущий → прошлые по убыванию */
export function buildYearTabs(
  tournaments: Tournament[],
  currentYear: number,
  options?: BuildYearTabsOptions
): number[] {
  const nextYear = currentYear + 1;
  const hasNextYearOpenRegistration = tournaments.some(
    (t) =>
      getTournamentYear(t) === nextYear &&
      t.status === TournamentStatus.REGISTRATION
  );
  const hasNextYearTournaments = tournaments.some(
    (t) => getTournamentYear(t) === nextYear
  );
  const showNextYear =
    hasNextYearOpenRegistration ||
    (options?.includeNextYearWhenHasTournaments === true &&
      hasNextYearTournaments);

  const pastYears = [
    ...new Set(
      tournaments
        .map(getTournamentYear)
        .filter((year) => year < currentYear)
    ),
  ].sort((a, b) => b - a);

  const tabs: number[] = [];
  if (showNextYear) {
    tabs.push(nextYear);
  }
  tabs.push(currentYear);
  tabs.push(...pastYears);
  return tabs;
}

export function filterTournamentsByYear(
  tournaments: Tournament[],
  year: number
): Tournament[] {
  return tournaments
    .filter((t) => getTournamentYear(t) === year)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
