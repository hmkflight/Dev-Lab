import { z } from "zod";
const text = z.string().max(30000);
export const context = z.object({
  description: text,
  goals: text,
  audience: text,
  requirements: text,
  notes: text,
  links: z
    .array(
      z.url().refine((u) => /^https?:\/\//.test(u), "Use http or https links."),
    )
    .max(100),
  email: z.union([z.email(), z.literal("")]),
  phone: text,
  address: text,
  socials: text,
  anythingElse: text,
});
export const input = z.object({
  name: z.string().trim().min(1).max(100),
  industry: z.string().max(100),
  context,
  referenceIds: z.array(z.string()).max(100),
});
