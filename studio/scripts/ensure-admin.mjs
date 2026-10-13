// On first start, create an admin from ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD
// when the database has no users yet. Does nothing afterwards.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const { ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD } = process.env;
if ((await db.user.count()) === 0) {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 10) {
    console.warn("Geen gebruikers en geen ADMIN_EMAIL/ADMIN_PASSWORD (min. 10 tekens): niemand kan inloggen.");
  } else {
    await db.user.create({
      data: {
        email: ADMIN_EMAIL.toLowerCase(),
        name: ADMIN_NAME || "Admin",
        role: "admin",
        passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      },
    });
    console.log(`Eerste admin aangemaakt: ${ADMIN_EMAIL}`);
  }
}
await db.$disconnect();
