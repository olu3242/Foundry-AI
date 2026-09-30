export type NavKey = "today" | "records" | "pulse" | "passport" | "settings";

export const NAV: { key: NavKey; label: string; segment: string }[] = [
  { key: "today", label: "Today", segment: "" },
  { key: "records", label: "Records", segment: "/records" },
  { key: "pulse", label: "Pulse", segment: "/pulse" },
  { key: "passport", label: "Passport", segment: "/passport" },
  { key: "settings", label: "Settings", segment: "/settings" },
];
