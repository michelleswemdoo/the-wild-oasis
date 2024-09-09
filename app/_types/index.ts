export type Guest = {
  email: string;
  fullName: string;
  nationality?: string;
  nationalID?: string;
  countryFlag?: string;
};

export type CabinProps = {
  cabin: {
    id: string;
    name: string;
    maxCapacity: number;
    regularPrice: number;
    discount: number;
    image: string;
    description: string;
  };
};

export type Capacity = 'all' | 'small' | 'medium' | 'large';

export type BookingProps = {
  startDate: Date | undefined;
  endDate: Date | undefined;
  numNights: number;
  cabinPrice: number;
  cabinId: string;
};

interface Cabin {
  name: string;
  image: string;
}

export type AllBookings = {
  id: number;
  created_at: Date;
  startDate: Date;
  endDate: Date;
  numNights: number;
  numGuests: number;
  totalPrice: number;
  guestId: number;
  cabinId: string;
  cabins: Cabin;
};

export type SingleBooking = {
  booking: AllBookings;
};

export type Bookings = {
  bookings: AllBookings[];
};

export type CountryProps = {
  name: string;
  flag: string;
  independent: boolean;
};
