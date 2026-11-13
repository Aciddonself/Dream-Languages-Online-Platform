const SCHOOL_TIME_ZONE = "Africa/Kampala";

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function formatSchoolDateTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: SCHOOL_TIME_ZONE,
  }).format(asDate(value));
}

export function formatSchoolDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-UG", {
    dateStyle: "medium",
    timeZone: SCHOOL_TIME_ZONE,
  }).format(asDate(value));
}

export function formatSchoolTime(value: Date | string) {
  return new Intl.DateTimeFormat("en-UG", {
    timeStyle: "short",
    timeZone: SCHOOL_TIME_ZONE,
  }).format(asDate(value));
}
