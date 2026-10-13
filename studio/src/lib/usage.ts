import "server-only";
import { db } from "./db";
import { HttpError } from "./auth";

export function monthStart(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export async function monthSpendCents(userId: string) {
  const agg = await db.usageEvent.aggregate({
    where: { userId, createdAt: { gte: monthStart() } },
    _sum: { cents: true },
  });
  return agg._sum.cents ?? 0;
}

/** Throws 402 when this request would push the user over their monthly limit. */
export async function assertBudget(userId: string, extraCents: number) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.budgetCents) return;
  const spent = await monthSpendCents(userId);
  if (spent + extraCents > user.budgetCents) {
    throw new HttpError(
      402,
      `Maandbudget bereikt ($${(spent / 100).toFixed(2)} van $${(user.budgetCents / 100).toFixed(2)}). Vraag een admin om het te verhogen.`,
    );
  }
}

export async function recordUsage(userId: string, kind: "image" | "video" | "chat", model: string, cents: number) {
  if (cents <= 0) return;
  await db.usageEvent.create({ data: { userId, kind, model, cents } });
}
