import { TournamentCategoryEnum } from "../types";

export function parseTournamentCategoryInput(
  raw: string | number | undefined | null,
): TournamentCategoryEnum | null {
  if (raw === undefined || raw === null || raw === "") {
    return null;
  }

  const value = String(raw).toUpperCase();

  if (value === "1" || value === "FEDERAL") {
    return TournamentCategoryEnum.FEDERAL;
  }
  if (value === "2" || value === "REGIONAL") {
    return TournamentCategoryEnum.REGIONAL;
  }
  if (value === "3" || value === "CLUB") {
    return TournamentCategoryEnum.CLUB;
  }

  return null;
}

export function tournamentCategoryDbToEnum(
  category: string | number,
): TournamentCategoryEnum {
  return (
    parseTournamentCategoryInput(category) ?? TournamentCategoryEnum.FEDERAL
  );
}

export function isRatingTournamentCategory(
  category: TournamentCategoryEnum,
): boolean {
  return category !== TournamentCategoryEnum.CLUB;
}
