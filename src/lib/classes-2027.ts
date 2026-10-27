export const YEAR = 2027;
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const LEVELS = ["A1", "A2", "B1", "B2"] as const;
export const MODES = ["Physical", "Online"] as const;
export type Level = (typeof LEVELS)[number];
export type Mode = (typeof MODES)[number];

/** Class start times in minutes after midnight. */
export const SLOTS: Record<Mode, Record<Level, number>> = {
  Physical: { A1: 480, A2: 630, B1: 840, B2: 990 },
  Online: { A1: 1080, A2: 1080, B1: 1080, B2: 1080 },
};

const HOLIDAY_LIST: [number, number, string][] = [
  [0, 1, "New Year's Day"], [0, 26, "Liberation Day"], [1, 16, "Janani Luwum Day"], [2, 8, "Women's Day"],
  [2, 26, "Good Friday"], [2, 29, "Easter Monday"], [4, 1, "Labour Day"], [5, 3, "Martyrs' Day"],
  [5, 9, "Heroes' Day"], [9, 9, "Independence Day"], [11, 25, "Christmas Day"], [11, 26, "Boxing Day"],
];

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const make = (y: number, m: number, d: number) => new Date(y, m, d);
export const addDays = (d: Date, n: number) => make(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const holidays = new Map(HOLIDAY_LIST.map(([m, d, name]) => [dayKey(make(YEAR, m, d)), name]));

export type Intake = {
  month: number;
  start: Date;
  regOpens: Date;
  regCloses: Date;
  examRegCloses: Date;
  mock: Date;
  finalOne: Date;
  finalTwo: Date;
  end: Date;
};

function buildIntakes(): Intake[] {
  return MONTHS.map((_, month) => {
    let base = make(YEAR, month, 1);
    while (base.getDay() !== 1) base = addDays(base, 1);
    base = addDays(base, 7);
    let start = base;
    while (holidays.has(dayKey(start)) || start.getDay() === 0 || start.getDay() === 6) start = addDays(start, 1);
    return {
      month,
      start,
      regOpens: addDays(base, -28),
      regCloses: addDays(base, -3),
      examRegCloses: addDays(base, 32),
      mock: addDays(base, 53),
      finalOne: addDays(base, 59),
      finalTwo: addDays(base, 60),
      end: addDays(base, 60),
    };
  });
}

export const intakes = buildIntakes();

export const dateLong = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const dateShort = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function clock(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h > 12 ? h - 12 : h}:${m < 10 ? "0" : ""}${m} ${h >= 12 ? "PM" : "AM"}`;
}
export const range = (from: number, to: number) => `${clock(from)} – ${clock(to)}`;

export function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}
export function relative(n: number) {
  return n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
}

export type Upcoming = { date: Date; label: string };

export function upcomingEvents(today: Date): Upcoming[] {
  const events: Upcoming[] = [];
  for (const i of intakes) {
    const name = MONTHS[i.month];
    events.push(
      { date: i.regOpens, label: `Registration opens, ${name} intake` },
      { date: i.regCloses, label: `Registration closes, ${name} intake` },
      { date: i.examRegCloses, label: `Exam registration closes, ${name} intake` },
      { date: i.start, label: `${name} classes start` },
      { date: i.mock, label: `Mock exam, ${name} intake` },
      { date: i.finalOne, label: `Final exams begin, ${name} intake` },
    );
  }
  return events.filter((e) => e.date >= today).sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function nextIntakeIndex(today: Date) {
  const found = intakes.findIndex((i) => i.end >= today);
  return found === -1 ? intakes.length - 1 : found;
}

export function shareText(intake: Intake, url: string) {
  const physical = LEVELS.map((v) => `${v} ${range(SLOTS.Physical[v], SLOTS.Physical[v] + 120)}`).join("; ");
  return [
    `*DLA Language Classes ${YEAR}*`,
    `First intake starts ${dateLong(intakes[0].start)} ${YEAR}. A new intake starts every month. Courses last 2 months.`,
    "Languages: German, English, French. Levels: A1, A2, B1, B2.",
    "",
    "*Class times (Mon to Fri, 2 hours a day)*",
    `Physical: ${physical}`,
    `Online: all levels ${range(SLOTS.Online.A1, SLOTS.Online.A1 + 120)}`,
    "",
    `*${MONTHS[intake.month]} intake*`,
    `Registration: ${dateShort(intake.regOpens)} to ${dateLong(intake.regCloses)}`,
    `Exam registration closes: ${dateLong(intake.examRegCloses)}`,
    `Mock exam: ${dateLong(intake.mock)}`,
    `Final exams: ${dateShort(intake.finalOne)} and ${dateLong(intake.finalTwo)}`,
    "",
    `Full brochure: ${url}`,
  ].join("\n");
}
