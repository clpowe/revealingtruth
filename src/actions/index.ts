import { ActionError, defineAction } from "astro:actions";
import { env } from "cloudflare:workers";
import { connectInput } from "../config/prayers.ts";

export const server = {
  submitPrayerRequest: defineAction({
    accept: "form",
    // Validated on the server: the browser's checks are easy to skip
    input: connectInput,

    handler: async (input) => {
      try {
        await env.PRAYER_DB.prepare(
          `INSERT INTO prayer_requests (id, name, email, phone, message)
           VALUES (?, ?, ?, ?, ?)`,
        )
          .bind(crypto.randomUUID(), input.name, input.email, input.phone ?? null, input.message)
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
