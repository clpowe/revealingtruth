import { z } from "astro/zod";
import { FetchError, ofetch } from "ofetch";

const api = ofetch.create({
  baseURL: "https://www.googleapis.com/youtube/v3",
  retry: 2,
  retryDelay: 500,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  parseResponse: JSON.parse,
});

/** A Data API resource, checked against `schema` before anything reads it */
export async function youtube<S extends z.ZodType>(
  resource: string,
  schema: S,
  query: Record<string, string>,
  timeout = 10_000,
): Promise<z.output<S>> {
  let data: unknown;
  try {
    data = await api<unknown>(resource, { query, timeout });
  } catch (error) {
    throw sanitize(error, `YouTube ${resource}`);
  }
  const parsed = schema.safeParse(data);
  // Paths only: the issues' own text can quote the response
  if (!parsed.success) {
    const paths = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)");
    throw new Error(`YouTube ${resource} sent unexpected data at ${paths.join(", ")}`);
  }
  return parsed.data;
}

function sanitize(error: unknown, label: string): Error {
  if (error instanceof FetchError) {
    if (error.statusCode) return new Error(`${label} responded ${error.statusCode}`);
    if (error.cause instanceof Error) return new Error(`${label} failed: ${error.cause.name}`);
  }
  if (error instanceof SyntaxError) return new Error(`${label} sent invalid JSON`);
  return new Error(`${label} failed`);
}
