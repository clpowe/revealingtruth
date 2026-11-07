import { ActionError, defineAction } from "astro:actions";
import { z } from "astro/zod";
import { env } from "cloudflare:workers";
import { LIMITS } from "../config/prayers.ts";

export const server = {
  submitPrayerRequest: defineAction({
    accept: "form",
    // Validated on the server: the browser's checks are easy to skip
    input: z
      .object({
        name: z
          .string({ error: "Please tell us your name." })
          .trim()
          .min(1, "Please tell us your name.")
          .max(LIMITS.name, "Please use a shorter name."),
        email: z
          .email({ error: "Please enter a valid email address." })
          .max(LIMITS.email, "Please enter a valid email address."),
        phone: z
          .string({ error: "Please enter a valid phone number." })
          .trim()
          .regex(/^\+?[\d ().-]{7,20}$/, "Please enter a valid phone number."),
        message: z
          .string({ error: "Please share your prayer request." })
          .trim()
          .min(1, "Please share your prayer request.")
          .max(LIMITS.message, "Please shorten your request."),
        sms: z.boolean(),
      })
      .refine((data) => !data.sms || data.phone, {
        error: "Add your phone number so we can text you.",
        path: ["phone"],
      }),

    handler: async (input) => {
      try {
        await env.PRAYER_DB.prepare(
          `INSERT INTO prayer_requests (id, name, email, phone, message, sms_opt_in)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
          .bind(
            crypto.randomUUID(),
            input.name,
            input.email,
            input.phone ?? null,
            input.message || null,
            input.sms ? 1 : 0,
          )
          .run();
      } catch (error) {
        // Log the error, never the input: requests are private
        console.error(
          "prayer request: insert failed",
          error instanceof Error ? error.message : "unknown error",
        );
        throw new ActionError({ code: "INTERNAL_SERVER_ERROR", message: "Insert failed" });
      }

      return { ok: true };
    },
  }),
};
