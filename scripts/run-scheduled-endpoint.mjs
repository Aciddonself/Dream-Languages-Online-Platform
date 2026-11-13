const allowedEndpoints = new Set([
  "/api/cron/school-emails",
  "/api/cron/holiday-reminders",
]);

const appUrl = process.env.APP_URL;
const cronSecret = process.env.CRON_SECRET;
const endpointPath = process.env.SCHEDULER_PATH;

if (!appUrl || !cronSecret || !endpointPath || !allowedEndpoints.has(endpointPath)) {
  console.error("Set APP_URL, CRON_SECRET, and a supported SCHEDULER_PATH in the Railway cron service.");
  process.exit(1);
}

let url;
try {
  url = new URL(endpointPath, appUrl);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("HTTPS required");
} catch {
  console.error("APP_URL must be a valid HTTPS URL in production.");
  process.exit(1);
}

try {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${cronSecret}` },
    cache: "no-store",
    signal: AbortSignal.timeout(55_000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`Scheduled endpoint failed with HTTP ${response.status}.`);
    process.exitCode = 1;
  } else {
    const summary = result && typeof result === "object"
      ? Object.fromEntries(["ok", "sentCount", "failedCount", "remindedHolidayCount"].filter((key) => key in result).map((key) => [key, result[key]]))
      : {};
    console.log(`Scheduled endpoint completed: ${endpointPath}`, summary);
  }
} catch (error) {
  console.error("Could not reach the scheduled endpoint:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
}
