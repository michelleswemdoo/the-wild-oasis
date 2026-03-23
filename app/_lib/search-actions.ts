'use server';

import { differenceInDays } from 'date-fns';
import { type CabinCardRow } from './cabin-filters';
import { auth } from './auth';
import { getBookings, getCabinPrice, getCabinsForSearch } from './data-service';
import { matchCabinsToQuery } from './natural-search';
import { supabase } from './supabase';
import { revalidatePath } from 'next/cache';

export type NaturalSearchResult = {
  ok: true;
  cabins: CabinCardRow[];
  message: string;
};

export type NaturalSearchError = {
  ok: false;
  error: string;
};

export type ConversationResult = {
  ok: true;
  reply: string;
  state: ConversationState;
  cabins: CabinCardRow[];
} | {
  ok: false;
  reply: string;
  state: ConversationState;
  cabins: CabinCardRow[];
};

export type ConversationState = {
  guests?: number;
  wantsBudget?: boolean;
  wantsViews?: boolean;
  wantsQuiet?: boolean;
  startDate?: string;
  endDate?: string;
  selectedCabinId?: string;
  selectedCabinName?: string;
  bookingRequested?: boolean;
};

function toIsoDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function extractDateRangeFromText(q: string): { startDate?: string; endDate?: string } {
  // ISO dates, e.g. 2026-05-10
  const iso = Array.from(
    q.matchAll(/\b(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])\b/g),
  ).map((m) => m[0]);

  // Slash dates, e.g. 2026/05/10 or 05/10/2026
  const slashYmd = Array.from(
    q.matchAll(/\b(20\d{2})\/(0?[1-9]|1[0-2])\/([0-2]?\d|3[01])\b/g),
  ).map((m) => `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`);
  const slashMdy = Array.from(
    q.matchAll(/\b(0?[1-9]|1[0-2])\/([0-2]?\d|3[01])\/(20\d{2})\b/g),
  ).map((m) => `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`);

  // Month name format, e.g. May 10 2026
  const monthNames = Array.from(
    q.matchAll(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+([0-2]?\d|3[01]),?\s+(20\d{2})\b/gi,
    ),
  ).map((m) => {
    const parsed = new Date(`${m[1]} ${m[2]} ${m[3]}`);
    return Number.isNaN(parsed.getTime()) ? undefined : toIsoDateString(parsed);
  }).filter((d): d is string => Boolean(d));

  const all = [...iso, ...slashYmd, ...slashMdy, ...monthNames];
  return { startDate: all[0], endDate: all[1] };
}

function extractConversationSlots(text: string): Partial<ConversationState> {
  const q = text.toLowerCase();
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

  const wordMatch = q.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(people|persons|guests?)\b|\bfor\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/i,
  );
  const word = (wordMatch?.[1] ?? wordMatch?.[3])?.toLowerCase();

  const guests =
    digit ? Number(digit) : word && numberWords[word] ? numberWords[word] : undefined;
  const { startDate, endDate } = extractDateRangeFromText(q);
  const cabinNameMatch = q.match(/\bcabin\s*([0-9]{1,3})\b/i);
  const selectedCabinName = cabinNameMatch
    ? String(cabinNameMatch[1]).padStart(3, '0')
    : undefined;

  return {
    guests,
    wantsBudget: /\bbudget|cheap|affordable|inexpensive|value\b/i.test(q),
    wantsViews: /\bview|views|mountain|scenic|panorama|valley\b/i.test(q),
    wantsQuiet: /\bquiet|cozy|peaceful|private|calm|tranquil\b/i.test(q),
    startDate,
    endDate,
    selectedCabinName,
  };
}

function mergeConversationState(
  current: ConversationState | undefined,
  patch: Partial<ConversationState>,
): ConversationState {
  return {
    guests: patch.guests ?? current?.guests,
    wantsBudget: patch.wantsBudget || current?.wantsBudget || false,
    wantsViews: patch.wantsViews || current?.wantsViews || false,
    wantsQuiet: patch.wantsQuiet || current?.wantsQuiet || false,
    startDate: patch.startDate ?? current?.startDate,
    endDate: patch.endDate ?? current?.endDate,
    selectedCabinId: patch.selectedCabinId ?? current?.selectedCabinId,
    selectedCabinName: patch.selectedCabinName ?? current?.selectedCabinName,
    bookingRequested: patch.bookingRequested ?? current?.bookingRequested ?? false,
  };
}

function stateToQuery(state: ConversationState, fallbackMessage: string) {
  const parts: string[] = [];
  if (state.guests) parts.push(`for ${state.guests} guests`);
  if (state.wantsBudget) parts.push('budget friendly');
  if (state.wantsViews) parts.push('with mountain views');
  if (state.wantsQuiet) parts.push('quiet and cozy');
  const built = parts.join(' ');
  return built || fallbackMessage;
}

function isValidDateRange(startDate?: string, endDate?: string) {
  if (!startDate || !endDate) return false;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start;
}

async function createBookingFromConversation({
  sessionGuestId,
  cabinId,
  startDate,
  endDate,
  guests,
}: {
  sessionGuestId: number;
  cabinId: string;
  startDate: string;
  endDate: string;
  guests: number;
}) {
  const existing = await getBookings(sessionGuestId);
  if (existing.length > 0) {
    return {
      ok: false as const,
      reply: 'Demo mode allows only one reservation per account.',
    };
  }

  const price = await getCabinPrice(cabinId);
  if (!price) {
    return {
      ok: false as const,
      reply: 'I could not load pricing for that cabin.',
    };
  }

  const numNights = differenceInDays(new Date(endDate), new Date(startDate));
  if (numNights <= 0) {
    return {
      ok: false as const,
      reply: 'Your end date must be after your start date.',
    };
  }

  const cabinPricePerNight = price.regularPrice - price.discount;
  const booking = {
    cabinId,
    guestId: sessionGuestId,
    startDate,
    endDate,
    numNights,
    numGuests: guests,
    cabinPrice: numNights * cabinPricePerNight,
    extrasPrice: 0,
    totalPrice: numNights * cabinPricePerNight,
    isPaid: false,
    hasBreakfast: false,
    observations: 'Booked via cabin assistant',
    status: 'unconfirmed',
  };

  const { error } = await supabase.from('bookings').insert([booking]);
  if (error) {
    return {
      ok: false as const,
      reply: 'Booking failed. Please try again.',
    };
  }

  revalidatePath('/cabins');
  revalidatePath('/account/reservations');
  return { ok: true as const };
}

export async function searchCabinsNatural(
  query: string,
): Promise<NaturalSearchResult | NaturalSearchError> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { ok: false, error: 'Enter a search to find cabins.' };
  }

  try {
    const rows = await getCabinsForSearch();
    if (!rows?.length) {
      return { ok: false, error: 'No cabins are available to search right now.' };
    }

    const { matchedIds, reply } = await matchCabinsToQuery(trimmed, rows);

    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered: CabinCardRow[] = [];
    for (const id of matchedIds) {
      const row = byId.get(id);
      if (row) {
        ordered.push({
          id: row.id,
          name: row.name,
          maxCapacity: row.maxCapacity,
          regularPrice: row.regularPrice,
          discount: row.discount,
          image: row.image,
        });
      }
    }

    return {
      ok: true,
      cabins: ordered,
      message: reply,
    };
  } catch (e) {
    console.error(e);
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : 'Search failed. Try again in a moment.',
    };
  }
}

export async function converseCabinsAssistant(
  message: string,
  currentState?: ConversationState,
): Promise<ConversationResult> {
  const trimmed = message.trim();
  if (!trimmed) {
    return {
      ok: false,
      reply: 'Tell me what kind of cabin you want and I will suggest matches.',
      state: currentState ?? {},
      cabins: [],
    };
  }

  const slots = extractConversationSlots(trimmed);
  const state = mergeConversationState(currentState, slots);

  const session = await auth();
  const bookingIntent =
    /\b(book|reserve|reservation|confirm|checkout|pay|i want this|take it|go ahead|let's do it)\b/i.test(
      trimmed,
    );
  const confirmIntent = /\b(confirm booking|confirm reservation|confirm)\b/i.test(
    trimmed,
  );
  const bookingBlocked = bookingIntent && !session?.user;
  if (bookingIntent) state.bookingRequested = true;

  const builtQuery = stateToQuery(state, trimmed);
  const search = await searchCabinsNatural(builtQuery);
  if (!search.ok) return { ok: false, reply: search.error, state, cabins: [] };

  if (state.selectedCabinName) {
    const selectedByName = search.cabins.find(
      (c) => c.name === state.selectedCabinName,
    );
    if (selectedByName) {
      state.selectedCabinId = selectedByName.id;
      state.selectedCabinName = selectedByName.name;
    }
  }

  if (!state.selectedCabinId && search.cabins[0]) {
    state.selectedCabinId = search.cabins[0].id;
    state.selectedCabinName = search.cabins[0].name;
  }

  const top = search.cabins
    .slice(0, 3)
    .map((c) => `Cabin ${c.name} (${c.maxCapacity} guests)`)
    .join(', ');

  if (confirmIntent) {
    if (!session?.user?.guestId) {
      return {
        ok: false,
        reply: 'Please log in before confirming a booking.',
        state,
        cabins: search.cabins,
      };
    }
    if (
      !state.selectedCabinId ||
      !state.guests ||
      !isValidDateRange(state.startDate, state.endDate)
    ) {
      return {
        ok: false,
        reply:
          'Before confirming, share full details in one message: cabin preference, guest count, start date and end date (YYYY-MM-DD).',
        state,
        cabins: search.cabins,
      };
    }

    const created = await createBookingFromConversation({
      sessionGuestId: session.user.guestId,
      cabinId: state.selectedCabinId,
      guests: state.guests,
      startDate: state.startDate!,
      endDate: state.endDate!,
    });

    if (!created.ok) {
      return { ok: false, reply: created.reply, state, cabins: search.cabins };
    }

    return {
      ok: true,
      reply: `Done — your reservation request for Cabin ${state.selectedCabinName ?? state.selectedCabinId} from ${state.startDate} to ${state.endDate} is created.`,
      state,
      cabins: search.cabins,
    };
  }

  if (bookingIntent && session?.user) {
    const missing: string[] = [];
    if (!state.guests) missing.push('guest count');
    if (!state.startDate || !state.endDate) missing.push('dates (YYYY-MM-DD)');
    const missingText = missing.length
      ? ` I still need ${missing.join(' and ')} before confirmation.`
      : '';

    return {
      ok: true,
      reply: `${search.message} Top options: ${top}. I selected Cabin ${state.selectedCabinName ?? state.selectedCabinId} as the default option.${missingText} You can share details in separate messages (e.g. "2 guests", "2026-05-10 to 2026-05-13"), then click Confirm booking.`,
      state,
      cabins: search.cabins,
    };
  }

  if (bookingBlocked) {
    const missing: string[] = [];
    if (!state.guests) missing.push('guest count');
    if (!state.startDate || !state.endDate) missing.push('check-in and check-out dates');
    const detailsText = missing.length
      ? ` I can still collect ${missing.join(' and ')} now.`
      : '';

    return {
      ok: false,
      reply: `You need to log in before I can place a booking. Please sign in at /login.${detailsText}`,
      state,
      cabins: search.cabins,
    };
  }

  const followUps: string[] = [];
  if (!state.guests) followUps.push('How many guests are traveling?');
  if (state.bookingRequested && (!state.startDate || !state.endDate))
    followUps.push('What check-in and check-out dates do you want?');
  if (!state.wantsViews && !state.wantsQuiet && !state.wantsBudget)
    followUps.push('Do you care most about views, quiet vibe, or budget?');
  const followUpText = followUps.length ? ` ${followUps[0]}` : '';
  const loginText = bookingBlocked
    ? ' You need to log in before I can place a booking.'
    : '';

  return {
    ok: true,
    reply: `${search.message} Top options: ${top}.${followUpText}${loginText}`,
    state,
    cabins: search.cabins,
  };
}
