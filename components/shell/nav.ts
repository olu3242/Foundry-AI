export type NavKey = "today" | "records" | "settings";

export const NAV: { key: NavKey; label: string; segment: string }[] = [
  { key: "today", label: "Today", segment: "" },
  { key: "records", label: "Records", segment: "/records" },
  { key: "settings", label: "Settings", segment: "/settings" },
];
