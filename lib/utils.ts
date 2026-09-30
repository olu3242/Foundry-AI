import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date, locale = "en") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value));
}
