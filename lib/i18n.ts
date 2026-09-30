/**
 * Minimal message catalogue (B19). Locale comes from the business's market; missing keys fall back
 * to English, so adding a language is data work, not code work.
 */
const en = {
  "nav.today": "Today", "nav.records": "Records", "nav.pulse": "Pulse", "nav.passport": "Passport", "nav.market": "Market",
  "nav.progress": "Progress", "nav.finance": "Finance", "nav.inbox": "Inbox", "nav.settings": "Settings", "nav.signout": "Sign out",
  "today.description": "Say, type or photograph what happened. Foundry drafts the record; you confirm it.",
  "capture.label": "What happened in the business?",
  "capture.placeholder": 'Say or type what happened, e.g. "Sold 2 bags of rice at 45k each to Mama Bisi, cash"',
  "capture.record": "Record",
} as const;
export type MessageKey = keyof typeof en;

const fr: Partial<Record<MessageKey, string>> = {
  "nav.today": "Aujourd'hui", "nav.records": "Registres", "nav.pulse": "Pouls", "nav.passport": "Passeport", "nav.market": "Marché",
  "nav.progress": "Progrès", "nav.finance": "Financement", "nav.inbox": "Boîte", "nav.settings": "Réglages", "nav.signout": "Se déconnecter",
  "today.description": "Dites, écrivez ou photographiez ce qui s'est passé. Foundry prépare l'écriture ; vous la confirmez.",
  "capture.label": "Que s'est-il passé dans l'entreprise ?",
  "capture.placeholder": "Dites ou écrivez ce qui s'est passé, ex. « Vendu 2 sacs de riz à 20 000 chacun à Awa, Wave »",
  "capture.record": "Enregistrer",
};

const catalogues: Record<string, Partial<Record<MessageKey, string>>> = { en, fr };

export function t(locale: string | null | undefined, key: MessageKey) {
  const lang = (locale ?? "en").split("-")[0]!;
  return catalogues[lang]?.[key] ?? en[key];
}

/** Speech recognition locale for the market (e.g. fr-SN, en-NG). */
export function speechLocale(locale: string | null | undefined, country: string) {
  return `${(locale ?? "en").split("-")[0]}-${country}`;
}
