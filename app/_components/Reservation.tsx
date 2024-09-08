import { auth } from '../_lib/auth';
import {
  getBookedDatesByCabinId,
  getSettings,
  getBookings,
} from '../_lib/data-service';
import { CabinProps } from '../_types';
import DateSelector from './DateSelector';
import LoginMessage from './LoginMessage';
import ReservationForm from './ReservationForm';

async function Reservation({ cabin }: CabinProps) {
  const session = await auth();

  const [settings, bookedDates] = await Promise.all([
    getSettings(),
    getBookedDatesByCabinId(cabin.id),
  ]);

  let bookings;
  if (session?.user?.guestId) {
    bookings = await getBookings(session?.user?.guestId);
  }

  const bookedGuest =
    bookings &&
    bookings?.length > 0 &&
    bookings?.find((booking) => booking?.guestId === session?.user?.guestId);

  let content = <LoginMessage />;

  if (session?.user) {
    content = <ReservationForm cabin={cabin} user={session.user} />;
  }

  if (bookedGuest) {
    content = (
      <div className="grid bg-primary-800">
        <p className="self-center py-12 text-center text-xl font-medium">
          👋 You can only create ONE booking in demo mode
        </p>
      </div>
    );
  }
  return (
    <div className="grid min-h-[400px] grid-cols-2 border border-primary-800">
      <DateSelector
        settings={settings}
        bookedDates={bookedDates}
        cabin={cabin}
      />
      {content}
    </div>
  );
}

export default Reservation;
