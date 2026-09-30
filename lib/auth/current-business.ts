export const CURRENT_BUSINESS_COOKIE = "fdy_bid";

/** Markets launched first. Currency and timezone default from the country. */
export const COUNTRIES = [
  { code: "NG", name: "Nigeria", currency: "NGN", timezone: "Africa/Lagos" },
  { code: "GH", name: "Ghana", currency: "GHS", timezone: "Africa/Accra" },
  { code: "KE", name: "Kenya", currency: "KES", timezone: "Africa/Nairobi" },
  { code: "ZA", name: "South Africa", currency: "ZAR", timezone: "Africa/Johannesburg" },
  { code: "RW", name: "Rwanda", currency: "RWF", timezone: "Africa/Kigali" },
  { code: "SN", name: "Senegal", currency: "XOF", timezone: "Africa/Dakar" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", timezone: "Africa/Abidjan" },
] as const;

export const SECTORS = [
  "Retail / provisions",
  "Wholesale",
  "Food & catering",
  "Salon & beauty",
  "Fashion & tailoring",
  "Workshop & repairs",
  "Manufacturing",
  "Farming & agro-processing",
  "Logistics & transport",
  "Professional services",
  "Other",
] as const;
