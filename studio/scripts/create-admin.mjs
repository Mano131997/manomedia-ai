// Usage: npm run create-admin -- you@manomedia.be "Your Name" "a-strong-password"
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, name, password] = process.argv.slice(2);
if (!email || !name || !password || password.length < 10) {
  console.error('Gebruik: npm run create-admin -- email@domein.be "Naam" "wachtwoord-van-min-10-tekens"');
  process.exit(1);
}
const db = new PrismaClient();
const passwordHash = await bcrypt.hash(password, 12);
const user = await db.user.upsert({
  where: { email: email.toLowerCase() },
  update: { name, passwordHash, role: "admin", active: true },
  create: { email: email.toLowerCase(), name, passwordHash, role: "admin" },
});
console.log(`Admin klaar: ${user.email}`);
await db.$disconnect();
