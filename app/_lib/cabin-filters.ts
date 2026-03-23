import { Capacity } from '../_types';

export type CabinCardRow = {
  id: string;
  name: string;
  maxCapacity: number;
  regularPrice: number;
  discount: number;
  image: string;
};

export function filterCabinsByCapacity<T extends CabinCardRow>(
  cabins: T[],
  filter: Capacity,
): T[] {
  if (filter === 'small')
    return cabins.filter((cabin) => cabin.maxCapacity <= 3);
  if (filter === 'medium')
    return cabins.filter(
      (cabin) => cabin.maxCapacity >= 4 && cabin.maxCapacity <= 7,
    );
  if (filter === 'large')
    return cabins.filter((cabin) => cabin.maxCapacity >= 8);
  return cabins;
}
