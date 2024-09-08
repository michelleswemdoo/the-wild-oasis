'use client';

import * as React from 'react';
import { DateRange } from 'react-day-picker';

type ReservationContextProps = {
  range: DateRange;
  setRange: React.Dispatch<React.SetStateAction<DateRange>>;
  resetRange: () => void;
};
type ReservationProviderProps = { children: React.ReactNode };

const initialState = { from: undefined, to: undefined };

const ReservationContext = React.createContext<ReservationContextProps>({
  range: initialState,
  setRange: (initialState) => {},
  resetRange: () => {},
});

function ReservationProvider({ children }: ReservationProviderProps) {
  const [range, setRange] = React.useState<DateRange>(initialState);

  const resetRange = () => setRange(initialState);

  return (
    <ReservationContext.Provider value={{ range, setRange, resetRange }}>
      {children}
    </ReservationContext.Provider>
  );
}

function useReservation() {
  const context = React.useContext(ReservationContext);
  if (context === undefined)
    throw new Error('Context was used outside provider');
  return context;
}

export { ReservationProvider, useReservation };
