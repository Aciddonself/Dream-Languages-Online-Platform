export const LANGUAGE_COURSE_PRICES = {
  regular: { 1: 500_000, 2: 800_000 },
  intensive: { 1: 1_000_000, 2: 1_800_000 },
  super_intensive: { 1: 1_500_000, 2: 2_500_000 },
} as const;

export const INTERNATIONAL_LANGUAGE_PRICES = { 1: 200, 2: 350 } as const;

export function getCourseTuition(input: {
  isInternational: boolean;
  studyFormat: string | null;
  studyDurationMonths: number | null;
}) {
  if (input.isInternational) {
    if (input.studyDurationMonths === 1) return { amount: INTERNATIONAL_LANGUAGE_PRICES[1], currency: "USD" };
    if (input.studyDurationMonths === 2) return { amount: INTERNATIONAL_LANGUAGE_PRICES[2], currency: "USD" };
    return null;
  }
  if (input.studyDurationMonths !== 1 && input.studyDurationMonths !== 2) return null;
  const duration = input.studyDurationMonths;
  const amount = input.studyFormat === "regular"
    ? LANGUAGE_COURSE_PRICES.regular[duration]
    : input.studyFormat === "intensive"
      ? LANGUAGE_COURSE_PRICES.intensive[duration]
      : input.studyFormat === "super_intensive"
        ? LANGUAGE_COURSE_PRICES.super_intensive[duration]
        : undefined;
  return amount ? { amount, currency: "UGX" } : null;
}
