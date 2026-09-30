export type NavKey = "today" | "settings";

export const NAV: { key: NavKey; label: string; segment: string }[] = [
  { key: "today", label: "Today", segment: "" },
  { key: "settings", label: "Settings", segment: "/settings" },
];
