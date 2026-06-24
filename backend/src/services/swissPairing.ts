export type SwissPairing = {
  team_a_id: number;
  team_b_id: number | null;
  is_bye: boolean;
};

export function pairKey(teamA: number, teamB: number): string {
  return teamA < teamB ? `${teamA}-${teamB}` : `${teamB}-${teamA}`;
}

export function generateRoundOnePairings(teamIds: number[]): SwissPairing[] {
  const sorted = [...teamIds];
  const pairs: SwissPairing[] = [];
  let left = 0;
  let right = sorted.length - 1;

  if (sorted.length % 2 === 1) {
    pairs.push({
      team_a_id: sorted[right],
      team_b_id: null,
      is_bye: true,
    });
    right -= 1;
  }

  while (left < right) {
    pairs.push({
      team_a_id: sorted[left],
      team_b_id: sorted[right],
      is_bye: false,
    });
    left += 1;
    right -= 1;
  }

  return pairs;
}

export function generateSwissPairings(
  rankedTeamIds: number[],
  playedPairs: Set<string>,
): SwissPairing[] {
  const unpaired = [...rankedTeamIds];
  const pairs: SwissPairing[] = [];

  while (unpaired.length > 0) {
    if (unpaired.length === 1) {
      pairs.push({
        team_a_id: unpaired.shift()!,
        team_b_id: null,
        is_bye: true,
      });
      continue;
    }

    const teamA = unpaired.shift()!;
    let partnerIndex = -1;

    for (let i = 0; i < unpaired.length; i++) {
      const teamB = unpaired[i];
      if (!playedPairs.has(pairKey(teamA, teamB))) {
        partnerIndex = i;
        break;
      }
    }

    if (partnerIndex === -1) {
      partnerIndex = unpaired.length - 1;
    }

    const teamB = unpaired.splice(partnerIndex, 1)[0];
    pairs.push({
      team_a_id: teamA,
      team_b_id: teamB,
      is_bye: false,
    });
  }

  return pairs;
}
