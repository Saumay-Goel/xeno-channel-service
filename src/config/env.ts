import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4001),
  CRM_RECEIPT_URL: z.string().url(),
  CALLBACK_SECRET: z.string().min(1),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid env:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}
export const env = parsed.data;
