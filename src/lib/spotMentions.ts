export interface SpotMention {
  count: number;
  mostRecentUsername: string | null;
}

export function formatSpotMentionText(mention: SpotMention): string | null {
  const { count, mostRecentUsername } = mention;
  if (count === 0 || !mostRecentUsername) return null;

  const othersCount = count - 1;
  if (othersCount === 0) return `Mentioned by @${mostRecentUsername}`;
  return `Mentioned by @${mostRecentUsername} and ${othersCount} other${
    othersCount === 1 ? "" : "s"
  }`;
}
