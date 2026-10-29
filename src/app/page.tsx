import Link from "next/link";

// The front page. The booking flow itself lives at /book.
const event = {
  name: "Sharad Utsav 2026",
  dates: "Tue 10 Nov – Sat 14 Nov 2026",
  place: "Radha Krishna Temple, Allen, Texas",
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-5 py-16 sm:px-8">
      <header className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-bright-gold">
          Festival booking
        </p>
        <h1 className="text-5xl font-semibold leading-tight sm:text-6xl">
          {event.name}
        </h1>
      </header>

      <dl className="grid gap-5 rounded-2xl border border-white/20 bg-white/5 p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-white/70">When</dt>
          <dd className="mt-1 text-lg">{event.dates}</dd>
        </div>
        <div>
          <dt className="text-sm text-white/70">Where</dt>
          <dd className="mt-1 text-lg">{event.place}</dd>
        </div>
      </dl>

      <div>
        {/* Dark text on gold: white on this gold is only 2.6:1, dark is 5.4:1. */}
        <Link
          href="/book"
          className="inline-flex min-h-12 items-center rounded-full bg-primary px-8 text-base font-semibold text-primary-dark transition-colors hover:bg-bright-gold"
        >
          Book tickets
        </Link>
      </div>
    </main>
  );
}
