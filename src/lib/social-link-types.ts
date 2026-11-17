export const SOCIAL_SLOTS = [
  { id: "facebook", name: "Facebook", placeholder: "https://www.facebook.com/your-page" },
  { id: "instagram", name: "Instagram", placeholder: "https://www.instagram.com/your-page" },
  { id: "tiktok1", name: "TikTok account 1", placeholder: "https://www.tiktok.com/@your-account" },
  { id: "tiktok2", name: "TikTok account 2", placeholder: "https://www.tiktok.com/@your-account" },
  { id: "linkedin", name: "LinkedIn", placeholder: "https://www.linkedin.com/company/your-page" },
  { id: "x", name: "X (Twitter)", placeholder: "https://x.com/your-page" },
  { id: "youtube", name: "YouTube", placeholder: "https://www.youtube.com/@your-channel" },
] as const;

export type SocialSlot = (typeof SOCIAL_SLOTS)[number]["id"];
export type SocialLink = { slot: SocialSlot; url: string };
export type SocialLinks = SocialLink[];

export const DEFAULT_SOCIAL_LINKS: SocialLinks = [
  { slot: "facebook", url: "" },
  { slot: "instagram", url: "" },
  { slot: "tiktok1", url: "https://www.tiktok.com/@dreamlanguageschools" },
  { slot: "tiktok2", url: "https://www.tiktok.com/@dream_languages_ug" },
  { slot: "linkedin", url: "" },
  { slot: "x", url: "" },
  { slot: "youtube", url: "" },
];
