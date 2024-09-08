import { User } from 'next-auth';

type GuestId = number;

declare module 'next-auth' {
  interface Session {
    user: User & {
      guestId: GuestId;
    };
  }
}
