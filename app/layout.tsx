import type { Metadata } from 'next';
import { Josefin_Sans } from 'next/font/google';
import './_styles/globals.css';
import Header from './_components/Header';
import { ReservationProvider } from './_components/ReservationContext';

type RootLayoutProps = { children: React.ReactNode };

const josefin = Josefin_Sans({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s / The Wild Oasis',
    default: 'Welcome / The Wild Oasis',
  },
  description:
    'Luxurious cabin hotel, located in the heart of the Italian Dolomites, surrounded by beautiful mountains and dark forests',
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body
        className={`${josefin.className} relative flex min-h-screen flex-col bg-primary-950 text-primary-100 antialiased`}
      >
        <div className="z-50 bg-accent-500 px-4 py-2 text-center text-lg font-medium text-primary-800">
          👋 You&apos;re in demo mode! You can log into the app, but you can
          create only&nbsp;
          <strong>
            <em>one short</em>
          </strong>
          &nbsp; reservation
        </div>
        <Header />
        <div className="grid flex-1 px-8 py-12">
          <main className="mx-auto w-full max-w-7xl">
            <ReservationProvider>{children}</ReservationProvider>
          </main>
        </div>
      </body>
    </html>
  );
}
