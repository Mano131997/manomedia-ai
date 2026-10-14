import { db } from "@/lib/db";
import { apiUser, handle } from "@/lib/auth";
import { monthStart } from "@/lib/usage";

export const GET = handle(async () => {
  await apiUser({ admin: true });
  const since = monthStart();
  const [byModel, byKind, total] = await Promise.all([
    db.usageEvent.groupBy({ by: ["model"], where: { createdAt: { gte: since } }, _sum: { cents: true }, _count: true }),
    db.usageEvent.groupBy({ by: ["kind"], where: { createdAt: { gte: since } }, _sum: { cents: true }, _count: true }),
    db.usageEvent.aggregate({ where: { createdAt: { gte: since } }, _sum: { cents: true } }),
  ]);
  return Response.json({
    since: since.toISOString(),
    totalCents: total._sum.cents ?? 0,
    byKind: byKind.map((k) => ({ kind: k.kind, cents: k._sum.cents ?? 0, count: k._count })),
    byModel: byModel.map((m) => ({ model: m.model, cents: m._sum.cents ?? 0, count: m._count })),
  });
});
