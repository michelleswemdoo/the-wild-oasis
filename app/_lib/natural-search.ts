import { createGroq } from '@ai-sdk/groq';
import { generateText } from 'ai';

export type CabinForSearch = {
  id: string;
  name: string;
  maxCapacity: number;
  regularPrice: number;
  discount: number;
  image: string;
  description: string | null;
};

const MAX_RESULTS = 4;

/** Words that match almost every cabin description and break keyword search. */
const STOPWORDS = new Set(
  [
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'is',
    'it',
    'as',
    'by',
    'with',
    'from',
    'not',
    'too',
    'very',
    'all',
    'any',
    'our',
    'your',
    'this',
    'that',
    'are',
    'was',
    'were',
    'be',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'just',
    'only',
    'also',
    'cabin',
    'cabins',
    'good',
    'nice',
    'great',
  ].map((w) => w.toLowerCase()),
);

const KEYWORD_GROUPS = {
  quiet: ['quiet', 'cozy', 'peaceful', 'private', 'calm', 'tranquil'],
  views: ['views', 'view', 'mountain', 'scenic', 'panorama', 'valley'],
  cheap: ['cheap', 'budget', 'affordable', 'inexpensive', 'value'],
} as const;

function meaningfulTokens(query: string) {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^[,.;:!?'"]+|[,.;:!?'"]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

type SearchIntent = {
  tokens: string[];
  wantsCheap: boolean;
  requestedGuests?: number;
  wantsQuietOrCozy: boolean;
  wantsViews: boolean;
};

function containsAny(text: string, words: readonly string[]) {
  return words.some((word) => text.includes(word));
}

function extractRequestedGuests(q: string): number | undefined {
  const numberWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };

  const digitMatch = q.match(/\b(\d{1,2})\s*(people|persons|guests?)\b|\bfor\s+(\d{1,2})\b/i);
  const digit = digitMatch?.[1] ?? digitMatch?.[3];
  if (digit) return Number(digit);

  const wordMatch = q.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(people|persons|guests?)\b|\bfor\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i,
  );
  const word = (wordMatch?.[1] ?? wordMatch?.[3])?.toLowerCase();
  if (word && numberWords[word]) return numberWords[word];

  if (/\bcouple\b|\bpair\b|\bduo\b|\bdouble\b/i.test(q)) return 2;
  return undefined;
}

function extractIntent(query: string): SearchIntent {
  const q = query.toLowerCase();

  return {
    tokens: meaningfulTokens(query),
    wantsCheap:
      /cheap|afford|budget|inexpensive|not too expensive|less expensive|lower price|save money|value/i.test(
        query,
      ),
    requestedGuests: extractRequestedGuests(q),
    wantsQuietOrCozy: containsAny(q, KEYWORD_GROUPS.quiet),
    wantsViews: containsAny(q, KEYWORD_GROUPS.views),
  };
}

type CabinScore = {
  id: string;
  score: number;
  capacityScore: number;
  priceScore: number;
  keywordScore: number;
  featureScore: number;
};

function scoreCabin(cabin: CabinForSearch, intent: SearchIntent): CabinScore {
  const name = cabin.name.toLowerCase();
  const description = `${cabin.name} ${cabin.description ?? ''}`.toLowerCase();
  const pricePerNight = cabin.regularPrice - cabin.discount;

  let capacityScore = 0;
  if (intent.requestedGuests) {
    const guests = intent.requestedGuests;
    if (cabin.maxCapacity < guests) capacityScore = 0;
    else if (cabin.maxCapacity <= guests + 1) capacityScore = 12;
    else if (cabin.maxCapacity <= guests + 3) capacityScore = 8;
    else capacityScore = 4;
  }

  let priceScore = 0;
  if (intent.wantsCheap) {
    priceScore = Math.max(0, 14 - pricePerNight / 30);
  }

  // Lower base keyword weight to avoid overpowering structured intent signals.
  const keywordScore = intent.tokens.reduce((acc, token) => {
    const inDescription = description.includes(token) ? 2 : 0;
    const inNameBoost = name.includes(token) ? 3 : 0;
    return acc + inDescription + inNameBoost;
  }, 0);

  let featureScore = 0;
  if (intent.wantsQuietOrCozy && containsAny(description, KEYWORD_GROUPS.quiet)) {
    featureScore += 6;
  }
  if (intent.wantsViews && containsAny(description, KEYWORD_GROUPS.views)) {
    featureScore += 6;
  }

  const score = capacityScore + priceScore + keywordScore + featureScore;

  return {
    id: cabin.id,
    score: Number(score.toFixed(2)),
    capacityScore,
    priceScore: Number(priceScore.toFixed(2)),
    keywordScore: Number(keywordScore.toFixed(2)),
    featureScore,
  };
}

type ShortlistReason =
  | 'normal'
  | 'no-tokens'
  | 'fallback-cheapest';

function deterministicShortlist(query: string, cabins: CabinForSearch[]) {
  const intent = extractIntent(query);
  const priceById = new Map(
    cabins.map((c) => [c.id, c.regularPrice - c.discount] as const),
  );
  const ranked = cabins
    .map((cabin) => scoreCabin(cabin, intent))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-breaker: prefer cheaper cabin when scores are equal.
      const aPrice = priceById.get(a.id) ?? 0;
      const bPrice = priceById.get(b.id) ?? 0;
      return aPrice - bPrice;
    });

  const allScoresZero = ranked.every((item) => item.score <= 0);
  const fallbackIds = cabins
    .slice()
    .sort((a, b) => {
      const aPrice = a.regularPrice - a.discount;
      const bPrice = b.regularPrice - b.discount;
      if (aPrice !== bPrice) return aPrice - bPrice;
      return a.maxCapacity - b.maxCapacity;
    })
    .slice(0, MAX_RESULTS)
    .map((item) => item.id);

  const matchedIds = allScoresZero
    ? fallbackIds
    : ranked.slice(0, MAX_RESULTS).map((item) => item.id);

  if (intent.tokens.length <= 1) {
    return {
      matchedIds,
      reason: 'no-tokens' as ShortlistReason,
    };
  }

  if (allScoresZero) {
    return {
      matchedIds,
      reason: 'fallback-cheapest' as ShortlistReason,
    };
  }

  return {
    matchedIds,
    reason: 'normal' as ShortlistReason,
  };
}

function defaultReply(reason: ShortlistReason) {
  if (reason === 'no-tokens') {
    return 'Add a bit more detail (e.g. quiet, views, budget, or guest count) to narrow the results.';
  }
  if (reason === 'fallback-cheapest') {
    return 'No strong match was found, so here are the best-value cabin options to start with.';
  }
  return 'These cabins match your request.';
}

async function generateReplyText(
  query: string,
  shortlistedCabins: CabinForSearch[],
  reason: ShortlistReason,
) {
  if (reason !== 'normal') return defaultReply(reason);
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return defaultReply(reason);

  try {
    const groq = createGroq({ apiKey });
    const shortlist = shortlistedCabins.map((c) => ({
      name: c.name,
      maxCapacity: c.maxCapacity,
      pricePerNight: c.regularPrice - c.discount,
      description: (c.description ?? '').slice(0, 160),
    }));

    const { text } = await generateText({
      model: groq('llama-3.1-8b-instant'),
      prompt: `Write one short friendly sentence (max 24 words) summarizing why these cabins were picked.
User query: "${query}".
Selection mode: "${reason}".
Cabins: ${JSON.stringify(shortlist)}.
Do not mention scoring, algorithms, AI, or any specific cabin name/id.`,
    });

    return text.trim() || defaultReply(reason);
  } catch {
    return defaultReply(reason);
  }
}

export async function matchCabinsToQuery(
  query: string,
  cabins: CabinForSearch[],
): Promise<{ matchedIds: string[]; reply: string }> {
  const trimmed = query.trim();
  if (cabins.length === 0) {
    return {
      matchedIds: [],
      reply: 'No cabins are available right now.',
    };
  }

  const shortlist = deterministicShortlist(trimmed, cabins);
  const cabinById = new Map(cabins.map((c) => [c.id, c] as const));
  const selected = shortlist.matchedIds
    .map((id) => cabinById.get(id))
    .filter((c): c is CabinForSearch => Boolean(c));
  const reply = await generateReplyText(trimmed, selected, shortlist.reason);

  return { matchedIds: shortlist.matchedIds, reply };
}
