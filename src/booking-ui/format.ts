import { cents, formatUsd } from "@/domain/money";
import { FESTIVAL_DAY_LABELS, isFestivalDay } from "@/domain/festival";

// The server sends whole cents as plain numbers. This is the only place they become "$".
export const usd = (amount: number) => formatUsd(cents(amount));

export const dayLabel = (day: string) => (isFestivalDay(day) ? FESTIVAL_DAY_LABELS[day] : day);
