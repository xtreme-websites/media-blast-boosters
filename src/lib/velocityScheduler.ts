import { Order } from "./constants";

/**
 * VelocityScheduler — Calculates the next recommended PR publish date
 * using logarithmic spacing to avoid robotic-looking patterns.
 *
 * Rules:
 *  - 0 published PRs  → today
 *  - 1 published PR   → today + 10 days (jumpstart)
 *  - 2+ published PRs → lastDate + 21 days ± random jitter (−2 to +2)
 */
export function getRecommendedDate(orders: Order[]): Date {
  const published = orders.filter(o => {
    const s = (o as any).status;
    return !s || s === "submitted" || s === "pending_review" || s === "published";
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (published.length === 0) return today;

  if (published.length === 1) {
    const d = new Date(today);
    d.setDate(d.getDate() + 10);
    return d;
  }

  // Find most recent PR date
  const sorted = [...published].sort((a, b) => {
    const da = new Date((a as any).submitted_at || a.date).getTime();
    const db = new Date((b as any).submitted_at || b.date).getTime();
    return db - da;
  });

  const lastDate = new Date((sorted[0] as any).submitted_at || sorted[0].date);
  lastDate.setHours(0, 0, 0, 0);

  // +21 days with ±2 jitter (deterministic per order ID to avoid re-randomizing)
  const jitter = (Math.random() * 4 - 2) | 0; // integer -2 to +2
  const recommended = new Date(lastDate);
  recommended.setDate(recommended.getDate() + 21 + jitter);

  // If recommended date is in the past, push to today + 3 days
  if (recommended <= today) {
    const fallback = new Date(today);
    fallback.setDate(fallback.getDate() + 3);
    return fallback;
  }

  return recommended;
}

/**
 * Generate projected PR dates for remaining credits.
 * Returns an array of dates starting from the next recommended date.
 */
export function getProjectedDates(orders: Order[], totalCredits: number): Date[] {
  if (totalCredits <= 0) return [];

  const dates: Date[] = [];
  const published = orders.filter(o => {
    const s = (o as any).status;
    return !s || s === "submitted" || s === "pending_review" || s === "published";
  });

  let baseDate = getRecommendedDate(orders);

  for (let i = 0; i < totalCredits; i++) {
    dates.push(new Date(baseDate));
    // Next projected date: +21 days from this one (no jitter for projections — clean display)
    baseDate = new Date(baseDate);
    baseDate.setDate(baseDate.getDate() + 21);
  }

  return dates;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateInput(date: Date): string {
  return date.toISOString().split("T")[0]; // YYYY-MM-DD for input[type=date]
}
