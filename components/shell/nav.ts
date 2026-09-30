export type NavKey = "today" | "records" | "pulse" | "passport" | "market" | "progress" | "finance" | "inbox" | "settings";

/** `mobile` items appear in the bottom tab bar; the rest live in the mobile header. */
export const NAV: { key: NavKey; label: string; segment: string; mobile: boolean }[] = [
  { key: "today", label: "Today", segment: "", mobile: true },
  { key: "records", label: "Records", segment: "/records", mobile: true },
  { key: "pulse", label: "Pulse", segment: "/pulse", mobile: true },
  { key: "passport", label: "Passport", segment: "/passport", mobile: true },
  { key: "market", label: "Market", segment: "/market", mobile: true },
  { key: "progress", label: "Progress", segment: "/progress", mobile: false },
  { key: "finance", label: "Finance", segment: "/finance", mobile: false },
  { key: "inbox", label: "Inbox", segment: "/inbox", mobile: false },
  { key: "settings", label: "Settings", segment: "/settings", mobile: false },
];
