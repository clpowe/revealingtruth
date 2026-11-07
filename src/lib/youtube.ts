import { FetchError, ofetch } from "ofetch";

const api = ofetch.create({
  baseURL: "https://www.googleapis.com/youtube/v3",
  retry: 2,
  retryDelay: 500,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
  parseResponse: JSON.parse,
});

export async function youtube<T>(
  resource: string,
  query: Record<string, string>,
  timeout = 10_000,
): Promise<T> {
  try {
    return await api<T>(resource, { query, timeout });
  } catch (error) {
    throw sanitize(error, `YouTube ${resource}`);
  }
}

export async function youtubeHtml(
  url: string,
  init: { headers?: Record<string, string>; timeout: number; cf?: RequestInitCfProperties },
): Promise<string | undefined> {
  try {
    return await ofetch(url, { ...init, responseType: "text", retry: 1, retryDelay: 500 });
  } catch (error) {
    if (error instanceof FetchError && error.statusCode === 404) return undefined;
    throw sanitize(error, "YouTube page");
  }
}

function sanitize(error: unknown, label: string): Error {
  if (error instanceof FetchError) {
    if (error.statusCode) return new Error(`${label} responded ${error.statusCode}`);
    if (error.cause instanceof Error) return new Error(`${label} failed: ${error.cause.name}`);
  }
  if (error instanceof SyntaxError) return new Error(`${label} sent invalid JSON`);
  return new Error(`${label} failed`);
}
