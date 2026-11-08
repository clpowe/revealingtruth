import { z } from "astro/zod";

export const LIMITS = {
  name: 100,
  email: 254,
  phone: 20,
  message: 4000,
} as const;

/* The connect form, validated on the server: the browser's checks are easy
   to skip. Astro reads an empty optional field as absent */
export const connectInput = z.object({
  name: z
    .string({ error: "Please tell us your name." })
    .trim()
    .min(1, "Please tell us your name.")
    .max(LIMITS.name, "Please use a shorter name."),
  email: z
    .email({ error: "Please enter a valid email address." })
    .max(LIMITS.email, "Please enter a valid email address."),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d ().-]{7,20}$/, "Please enter a valid phone number.")
    .optional(),
  message: z
    .string({ error: "Please tell us how we can help." })
    .trim()
    .min(1, "Please tell us how we can help.")
    .max(LIMITS.message, "Please shorten your message."),
});

export type ConnectInput = z.infer<typeof connectInput>;
