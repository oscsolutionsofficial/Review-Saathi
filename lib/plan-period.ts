export function getPlanPeriodLabel(durationDays?: number | null) {
  const days = Number(durationDays || 30);
  if (days === 365) return "year";
  if (days === 30) return "month";
  if (days === 1) return "day";
  return `${days} days`;
}

export function getPlanPeriodSuffix(durationDays?: number | null) {
  return `/${getPlanPeriodLabel(durationDays)}`;
}
