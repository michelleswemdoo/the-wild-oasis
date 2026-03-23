'use client';

import * as React from 'react';
import CabinCard from '@/app/_components/CabinCard';
import Filter from '@/app/_components/Filter';
import SpinnerMini from '@/app/_components/SpinnerMini';
import {
  filterCabinsByCapacity,
  type CabinCardRow,
} from '@/app/_lib/cabin-filters';
import {
  converseCabinsAssistant,
  type ConversationState,
} from '@/app/_lib/search-actions';
import { Capacity } from '@/app/_types';

type CabinsExplorerProps = {
  initialCabins: CabinCardRow[];
  capacityFilter: Capacity;
  isLoggedIn: boolean;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export default function CabinsExplorer({
  initialCabins,
  capacityFilter,
  isLoggedIn,
}: CabinsExplorerProps) {
  const [natural, setNatural] = React.useState<{
    cabins: CabinCardRow[];
    message: string;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isSearching, setIsSearching] = React.useState(false);
  const [queryText, setQueryText] = React.useState('');
  const [conversationState, setConversationState] =
    React.useState<ConversationState>({});
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'Describe your ideal cabin and I will suggest the best matches.',
    },
  ]);

  const displayed = React.useMemo(() => {
    const source = natural?.cabins ?? initialCabins;
    return filterCabinsByCapacity(source, capacityFilter);
  }, [natural, initialCabins, capacityFilter]);

  const hasActiveSearch = !!natural;
  const canConfirmBooking =
    Boolean(conversationState.selectedCabinId) &&
    Boolean(conversationState.guests) &&
    Boolean(conversationState.startDate) &&
    Boolean(conversationState.endDate);

  async function runAssistantTurn(userText: string) {
    setMessages((prev) => [...prev, { role: 'user', text: userText }]);
    setError(null);
    setIsSearching(true);
    try {
      const res = await converseCabinsAssistant(userText, conversationState);
      setConversationState(res.state);
      setMessages((prev) => [...prev, { role: 'assistant', text: res.reply }]);
      if (!res.ok) {
        setError(res.reply);
        setNatural(null);
        return;
      }
      setNatural({ cabins: res.cabins, message: res.reply });
    } finally {
      setIsSearching(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const query = (new FormData(form).get('q') as string) ?? queryText;
    const userText = query.trim();
    if (!userText) return;
    await runAssistantTurn(userText);
  }

  function clearNatural() {
    setNatural(null);
    setError(null);
    setQueryText('');
    setMessages([
      {
        role: 'assistant',
        text: 'Describe your ideal cabin and I will suggest the best matches.',
      },
    ]);
    setConversationState({});
  }

  return (
    <>
      <div className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <form
          onSubmit={handleSubmit}
          className="flex w-full max-w-2xl flex-col gap-2"
          aria-busy={isSearching}
          aria-describedby={error ? 'search-status search-error' : 'search-status'}
        >
          <label
            htmlFor="natural-search"
            className="text-sm font-medium text-primary-200"
          >
            Describe your ideal cabin
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="natural-search"
              name="q"
              type="search"
              placeholder="e.g. quiet cabin for two, good views, not too expensive…"
              className="min-w-0 flex-1 rounded-sm border border-primary-700 bg-primary-900 px-4 py-3 text-primary-100 placeholder:text-primary-500"
              disabled={isSearching}
              aria-disabled={isSearching}
              aria-invalid={Boolean(error)}
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
            />
            <button
              type="submit"
              disabled={isSearching}
              aria-disabled={isSearching}
              className="inline-flex items-center gap-2 rounded-sm bg-accent-500 px-5 py-3 font-medium text-primary-900 transition hover:bg-accent-400 disabled:opacity-60"
            >
              {isSearching ? <SpinnerMini /> : null}
              {isSearching ? 'Searching…' : 'Search'}
            </button>
          </div>
          <p id="search-status" role="status" aria-live="polite" className="sr-only">
            {isSearching
              ? 'Matching cabins...'
              : hasActiveSearch
                ? `Search complete. ${displayed.length} cabin${displayed.length === 1 ? '' : 's'} shown.`
                : ''}
          </p>
          {natural && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={clearNatural}
                className="text-sm text-accent-400 underline hover:text-accent-300"
              >
                Clear search
              </button>
            </div>
          )}
          {error && (
            <p id="search-error" role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="max-h-56 space-y-2 overflow-y-auto rounded-sm border border-primary-800 bg-primary-900/40 p-3">
            {messages.map((m, i) => (
              <p
                key={`${m.role}-${i}`}
                className={
                  m.role === 'assistant'
                    ? 'rounded-md bg-primary-800 p-3 text-sm text-primary-100'
                    : 'rounded-md bg-accent-500/10 p-3 text-sm text-accent-100'
                }
              >
                {m.text}
              </p>
            ))}
          </div>

          {canConfirmBooking && (
            <div className="flex flex-wrap items-center gap-3 rounded-sm border border-primary-800 bg-primary-900/40 p-3">
              <p className="text-sm text-primary-200">
                Ready to confirm booking for {conversationState.guests} guest
                {conversationState.guests === 1 ? '' : 's'} from{' '}
                {conversationState.startDate} to {conversationState.endDate}.
              </p>
              <button
                type="button"
                onClick={() => runAssistantTurn('confirm booking')}
                disabled={isSearching}
                className="rounded-sm bg-accent-500 px-4 py-2 text-sm font-medium text-primary-900 disabled:opacity-60"
              >
                Confirm booking
              </button>
              {!isLoggedIn ? (
                <p className="text-xs text-primary-400">
                  Log in first to complete booking.
                </p>
              ) : null}
            </div>
          )}
        </form>
        <div className="flex shrink-0 justify-end lg:pt-6">
          <Filter />
        </div>
      </div>

      <div
        className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:gap-12 xl:gap-14"
        aria-busy={isSearching}
      >
        {displayed.length === 0 ? (
          <p className="text-lg text-primary-300">
            {hasActiveSearch
              ? 'No cabins matched your search.'
              : 'No cabins available for this filter.'}
          </p>
        ) : (
          displayed.map((cabin) => <CabinCard cabin={cabin} key={cabin.id} />)
        )}
      </div>
    </>
  );
}
