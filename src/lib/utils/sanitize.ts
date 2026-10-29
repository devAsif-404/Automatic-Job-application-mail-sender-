import path from "path";

/**
 * Mitigates CSV / Spreadsheet formula injection (CWE-1236).
 * Any cell starting with =, +, -, @, tab, or carriage return is prefixed with a single quote.
 */
export function sanitizeForSpreadsheet(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value).trim();
  const dangerousPrefixes = ["=", "+", "-", "@", "\t", "\r"];
  if (dangerousPrefixes.some((prefix) => str.startsWith(prefix))) {
    return `'${str}`;
  }
  return str;
}

/**
 * Sanitizes uploaded filenames to prevent path traversal and arbitrary filesystem writes.
 */
export function sanitizeFileName(originalName: string): string {
  // Extract base filename without directories
  const base = path.basename(originalName);
  // Remove dangerous chars, keep alphanumerics, dots, hyphens, and underscores
  const clean = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Prevent hidden files starting with .
  return clean.startsWith(".") ? `file_${clean}` : clean;
}

/**
 * Normalizes email address for duplicate checking and consistency.
 */
export function normalizeEmail(email: string): string {
  if (!email) return "";
  return email.trim().toLowerCase();
}

/**
 * Redacts passwords, API keys, and sensitive tokens from log messages and error diagnostics.
 */
export function redactSensitive(text: string): string {
  if (!text) return "";
  return text
    .replace(/(password|pass|secret|key|token|auth)\s*[:=]\s*["']?((?:AIza|AQ\.)[0-9A-Za-z-_]{30,60})["']?/gi, "$1: [REDACTED_GEMINI_KEY]")
    .replace(/(?:AIza|AQ\.)[0-9A-Za-z-_]{30,60}/g, "[REDACTED_GEMINI_KEY]")
    .replace(/(password|pass|secret|key|token|auth)\s*[:=]\s*["']?(?!\[REDACTED)([^"',\s]+)["']?/gi, "$1: [REDACTED]")
    .replace(/bearer\s+[A-Za-z0-9-_.]+/gi, "Bearer [REDACTED]");
}
