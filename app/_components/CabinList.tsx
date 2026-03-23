import CabinCard from '@/app/_components/CabinCard';
import { filterCabinsByCapacity } from '../_lib/cabin-filters';
import { getCabins } from '../_lib/data-service';
import { Capacity } from '../_types';

type CabinListProps = { filter: Capacity };

async function CabinList({ filter }: CabinListProps) {
  const cabins = await getCabins();

  if (!cabins.length) return null;

  const displayedCabins = filterCabinsByCapacity(cabins, filter);

  return (
    <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:gap-12 xl:gap-14">
      {displayedCabins.map((cabin) => (
        <CabinCard cabin={cabin} key={cabin.id} />
      ))}
    </div>
  );
}

export default CabinList;
