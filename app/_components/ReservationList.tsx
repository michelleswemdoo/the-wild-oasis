'use client';
import * as React from 'react';
import ReservationCard from './ReservationCard';
import { deleteBooking } from '../_lib/actions';
import { Bookings } from '../_types';

function ReservationList({ bookings }: Bookings) {
  const [optimisticBookings, optimisticDelete] = React.useOptimistic(
    bookings,
    (curBookings, bookingId) => {
      return curBookings.filter((booking) => booking.id !== bookingId);
    },
  );

  async function handleDelete(bookingId: number) {
    optimisticDelete(bookingId);
    await deleteBooking(bookingId);
  }

  return (
    <ul className="space-y-6">
      {optimisticBookings.map((booking) => (
        <ReservationCard
          booking={booking}
          onDelete={handleDelete}
          key={booking.id}
        />
      ))}
    </ul>
  );
}

export default ReservationList;
