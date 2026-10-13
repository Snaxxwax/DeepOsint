import { createHash, randomUUID } from "node:crypto";
import path from "node:path";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export const uid = (prefix: string) => `${prefix}-${randomUUID()}`;
export const now = () => new Date().toISOString();
export function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ApiError(400, "JSON object required");
  return value as Record<string, any>;
}
export function str(
  value: unknown,
  name: string,
  max = 500,
  fallback?: string,
): string {
  if (value === undefined && fallback !== undefined) return fallback;
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new ApiError(
      400,
      `${name} must be a nonempty string of at most ${max} characters`,
    );
  return value;
}
export function choice<T extends string>(
  value: unknown,
  name: string,
  values: readonly T[],
  fallback?: T,
): T {
  const v = value === undefined ? fallback : value;
  if (!values.includes(v as T)) throw new ApiError(400, `Invalid ${name}`);
  return v as T;
}
export function boolean(
  value: unknown,
  name: string,
  fallback = false,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean")
    throw new ApiError(400, `${name} must be boolean`);
  return value;
}
export interface Config {
  dataDir: string;
  apiToken?: string;
  production: boolean;
  geminiKey?: string;
  geminiModel: string;
  searchProvider: "none" | "brave" | "tavily" | "searxng";
  searchKey?: string;
  searxngUrl?: string;
  python: string;
  maxConcurrent: number;
}
export function configFromEnv(): Config {
  const provider = choice(
    process.env.SEARCH_PROVIDER,
    "SEARCH_PROVIDER",
    ["none", "brave", "tavily", "searxng"] as const,
    "none",
  );
  const c: Config = {
    dataDir: path.resolve(process.env.DATA_DIR || "./data"),
    apiToken: process.env.API_TOKEN,
    production: process.env.NODE_ENV === "production",
    geminiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    searchProvider: provider,
    searchKey:
      provider === "brave"
        ? process.env.BRAVE_API_KEY
        : process.env.TAVILY_API_KEY,
    searxngUrl: process.env.SEARXNG_URL,
    python: process.env.PYTHON_BIN || "python3",
    maxConcurrent: 2,
  };
  if (c.production && (!c.apiToken || c.apiToken.length < 32))
    throw new Error(
      "Production requires API_TOKEN with at least 32 characters",
    );
  if (provider !== "none" && provider !== "searxng" && !c.searchKey)
    throw new Error(`${provider} search key is required`);
  if (provider === "searxng") {
    const url = new URL(c.searxngUrl || "");
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      throw new Error("Invalid SEARXNG_URL");
  }
  return c;
}
