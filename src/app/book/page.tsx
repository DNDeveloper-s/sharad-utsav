import type { Metadata } from "next";
import { BookingFlow } from "@/booking-ui/booking-flow";

export const metadata: Metadata = { title: "Book tickets | Sharad Utsav 2026" };

export default function BookPage() {
  return <BookingFlow />;
}
