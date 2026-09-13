/** Классический порядок посева в сетке (слоты слева направо сверху вниз). */
export function standardBracketSeedOrder(size: number): number[] {
  if (!Number.isInteger(size) || size < 2 || (size & (size - 1)) !== 0) {
    throw new Error("Размер сетки должен быть степенью двойки");
  }
  let bracket = [1];
  while (bracket.length < size) {
    const next: number[] = [];
    const sum = bracket.length * 2 + 1;
    for (const seed of bracket) {
      next.push(seed);
      next.push(sum - seed);
    }
    bracket = next;
  }
  return bracket;
}

export type FirstRoundPairSeeds = {
  matchIndex: number;
  seedA: number;
  seedB: number;
  nextMatchIndex: number;
};

/** Пары 1-го раунда по посеву: для 8 это 1–8, 4–5, 2–7, 3–6. */
export function firstRoundPairSeeds(size: number): FirstRoundPairSeeds[] {
  const order = standardBracketSeedOrder(size);
  const pairs: FirstRoundPairSeeds[] = [];
  for (let i = 0; i < order.length; i += 2) {
    const matchIndex = i / 2;
    pairs.push({
      matchIndex,
      seedA: order[i],
      seedB: order[i + 1],
      nextMatchIndex: Math.floor(matchIndex / 2),
    });
  }
  return pairs;
}

export function firstRoundLabel(size: number): string {
  if (size <= 2) {
    return "Финал";
  }
  if (size === 4) {
    return "1/2";
  }
  if (size === 8) {
    return "1/4";
  }
  if (size === 16) {
    return "1/8";
  }
  return "1-й раунд";
}
