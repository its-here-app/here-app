export interface SpotMentionSaver {
  username: string;
  followedAt: string;
}

export interface SpotMention {
  count: number;
  savers: SpotMentionSaver[];
}

export function formatSpotMentionText(
  mention: SpotMention,
  featuredUsername: string | null
): string | null {
  const { count } = mention;
  if (count === 0 || !featuredUsername) return null;

  const othersCount = count - 1;
  if (othersCount === 0) return `Mentioned by @${featuredUsername}`;
  return `Mentioned by @${featuredUsername} and ${othersCount} other${
    othersCount === 1 ? "" : "s"
  }`;
}

// Picks which saver's handle to feature in the mention text: whoever among
// the savers matches the given search query, tie-broken by most recently
// followed; falls back to the most recently followed saver when there's no
// query or no saver matches it.
export function getFeaturedSaver(
  mention: SpotMention | undefined,
  query: string
): SpotMentionSaver | null {
  if (!mention || mention.savers.length === 0) return null;

  const normalizedQuery = query.trim().replace(/^@/, "").toLowerCase();
  const matches = normalizedQuery
    ? mention.savers.filter((s) =>
        s.username.toLowerCase().includes(normalizedQuery)
      )
    : [];
  const pool = matches.length > 0 ? matches : mention.savers;

  return pool.reduce((latest, s) =>
    s.followedAt > latest.followedAt ? s : latest
  );
}
