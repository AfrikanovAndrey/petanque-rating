import { CupPosition } from "../types";

export type TeamCupResult = {
  teamId: number;
  cup: "A" | "B";
  position: CupPosition;
};

export function selectBestTeamCupResults(
  cupResults: TeamCupResult[]
): TeamCupResult[] {
  const positionPriority: Record<CupPosition, number> = {
    [CupPosition.WINNER]: 5,
    [CupPosition.RUNNER_UP]: 4,
    [CupPosition.THIRD_PLACE]: 3,
    [CupPosition.SEMI_FINAL]: 2,
    [CupPosition.QUARTER_FINAL]: 1,
  };

  const bestResultsMap = new Map<number, TeamCupResult>();

  for (const result of cupResults) {
    const existing = bestResultsMap.get(result.teamId);
    if (
      !existing ||
      positionPriority[result.position] > positionPriority[existing.position]
    ) {
      bestResultsMap.set(result.teamId, result);
    }
  }

  return Array.from(bestResultsMap.values());
}

export function getCupPositionPriority(): Record<CupPosition, number> {
  return {
    [CupPosition.WINNER]: 5,
    [CupPosition.RUNNER_UP]: 4,
    [CupPosition.THIRD_PLACE]: 3,
    [CupPosition.SEMI_FINAL]: 2,
    [CupPosition.QUARTER_FINAL]: 1,
  };
}
