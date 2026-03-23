import * as React from 'react';
import { auth } from '../_lib/auth';
import CabinsExplorer from '../_components/CabinsExplorer';
import ReservationReminder from '../_components/ReservationReminder';
import Spinner from '../_components/Spinner';
import { getCabins } from '../_lib/data-service';
import { Capacity } from '../_types';

type PageProps = {
  searchParams?: {
    capacity?: Capacity;
  };
};

export const revalidate = 3600;

export const metadata = {
  title: 'Cabins',
};

async function CabinsExplorerSection({
  filter,
  isLoggedIn,
}: {
  filter: Capacity;
  isLoggedIn: boolean;
}) {
  const cabins = await getCabins();

  return (
    <CabinsExplorer
      initialCabins={cabins}
      capacityFilter={filter}
      isLoggedIn={isLoggedIn}
    />
  );
}

export default async function Page({ searchParams }: PageProps) {
  const filter = searchParams?.capacity ?? 'all';
  const session = await auth();

  return (
    <div>
      <h1 className="mb-5 text-4xl font-medium text-accent-400">
        Our Luxury Cabins
      </h1>
      <p className="mb-10 text-lg text-primary-200">
        Cozy yet luxurious cabins, located right in the heart of the Italian
        Dolomites. Imagine waking up to beautiful mountain views, spending your
        days exploring the dark forests around, or just relaxing in your private
        hot tub under the stars. Enjoy nature&apos;s beauty in your own little
        home away from home. The perfect spot for a peaceful, calm vacation.
        Welcome to paradise.
      </p>

      <React.Suspense
        key={filter}
        fallback={
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 text-primary-300"
          >
            <Spinner />
            <span className="sr-only">Loading cabins...</span>
          </div>
        }
      >
        <CabinsExplorerSection
          filter={filter}
          isLoggedIn={Boolean(session?.user)}
        />
      </React.Suspense>
      <ReservationReminder />
    </div>
  );
}
