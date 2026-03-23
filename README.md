# The Wild Oasis

The Wild Oasis is a cabin reservation application built with Next.js and Supabase.

Live preview: https://the-wild-oasis-rho-gules.vercel.app/

## Current Features

- Cabin discovery with capacity filters
- Natural-language cabin search with deterministic ranking
- Inline conversational search flow (single input for search + conversation)
- Login-aware booking intent handling in conversation
- Booking confirmation flow from conversation (`confirm booking`) with server-side validation
- Google authentication with NextAuth
- Guest profile and reservation management

## Tech Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- Supabase (`@supabase/supabase-js`)
- NextAuth (Google provider)
- date-fns
- react-day-picker
- Heroicons
- AI SDK (`ai`) + Groq provider (`@ai-sdk/groq`) for assistant reply generation

## Environment Variables

Create a `.env` or `.env.local` file with:

```sh
SUPABASE_URL=...
SUPABASE_KEY=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
GROQ_API_KEY=... # optional, used for assistant-style reply text
```

## Getting Started

Install dependencies:

```sh
npm install
```

Run in development:

```sh
npm run dev
```

Create a production build:

```sh
npm run build
```

Start the production server:

```sh
npm run start
```

## Notes

- Booking creation is protected by authentication checks on the server.
- In demo mode, booking creation can be restricted by backend rules (for example, one booking per guest).
