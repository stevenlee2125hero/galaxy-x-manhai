import { appendFile, readFile } from "node:fs/promises";

function beijingDay(value) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const status = await readFile("public/sync-status.json", "utf8").then(JSON.parse).catch(() => ({}));
const shouldRun = !status.lastRun || beijingDay(status.lastRun) !== beijingDay(Date.now());
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `run=${shouldRun}\n`);
}
console.log(shouldRun ? "No sync recorded for today; running." : "Today's sync already completed; skipping retry.");
