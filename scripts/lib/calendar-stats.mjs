export function computeStats(weeks, today = new Date().toISOString().slice(0, 10)) {
  const days = weeks.flat();
  const past = days.filter((d) => d.date <= today);
  let best = 0;
  let run = 0;
  for (const d of past) {
    run = d.count > 0 ? run + 1 : 0;
    best = Math.max(best, run);
  }
  // A streak stays "current" until a full day passes without a contribution.
  let current = 0;
  let i = past.length - 1;
  if (i >= 0 && past[i].date === today && past[i].count === 0) i--;
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
  if (i >= 0 && past[i].date !== today && past[i].date !== yesterday) i = -1;
  for (; i >= 0 && past[i].count > 0; i--) current++;
  const total = past.reduce((s, d) => s + d.count, 0);
  const peak = past.reduce((m, d) => (d.count > m.count ? d : m), { count: 0, date: "" });
  return {
    total,
    best,
    current,
    peak,
    average: past.length ? total / past.length : 0,
    activeDays: past.filter((d) => d.count > 0).length,
    from: days[0]?.date ?? "",
    to: past.at(-1)?.date ?? "",
  };
}

