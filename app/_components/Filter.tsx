'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Capacity } from '../_types';

type Button = {
  filter: Capacity;
  handleFilter: (filter: Capacity) => void;
  activeFilter: string;
  children: string;
};

function Filter() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeFilter = searchParams.get('capacity') ?? 'all';

  function handleFilter(filter: Capacity) {
    const params = new URLSearchParams(searchParams);
    params.set('capacity', filter);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div
      className="flex border border-primary-800"
      role="group"
      aria-label="Filter cabins by guest capacity"
    >
      <Button
        filter="all"
        handleFilter={handleFilter}
        activeFilter={activeFilter}
      >
        All cabins
      </Button>
      <Button
        filter="small"
        handleFilter={handleFilter}
        activeFilter={activeFilter}
      >
        2&mdash;3 guests
      </Button>
      <Button
        filter="medium"
        handleFilter={handleFilter}
        activeFilter={activeFilter}
      >
        4&mdash;7 guests
      </Button>
      <Button
        filter="large"
        handleFilter={handleFilter}
        activeFilter={activeFilter}
      >
        8&mdash;12 guests
      </Button>
    </div>
  );
}

function Button({ filter, handleFilter, activeFilter, children }: Button) {
  const isActive = filter === activeFilter;
  return (
    <button
      className={`px-5 py-2 hover:bg-primary-700 ${
        isActive ? 'bg-primary-700 text-primary-50' : ''
      }`}
      onClick={() => handleFilter(filter)}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
}

export default Filter;
