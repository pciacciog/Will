// Single source of truth for username/handle rules, shared by client and server.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

/** Normalize a raw username input to its canonical stored form. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface UsernameValidation {
  valid: boolean;
  /** Canonical (normalized) value, present even when invalid for echoing back. */
  normalized: string;
  /** Human-readable reason when invalid. */
  reason?: string;
}

/**
 * Validates a raw username against the shared rules.
 * Does NOT check availability (that requires a DB lookup).
 */
export function validateUsername(raw: string): UsernameValidation {
  const normalized = normalizeUsername(raw ?? "");
  if (normalized.length < USERNAME_MIN) {
    return { valid: false, normalized, reason: `Username must be at least ${USERNAME_MIN} characters` };
  }
  if (normalized.length > USERNAME_MAX) {
    return { valid: false, normalized, reason: `Username must be at most ${USERNAME_MAX} characters` };
  }
  if (!USERNAME_REGEX.test(normalized)) {
    return { valid: false, normalized, reason: "Only letters, numbers, and underscores are allowed" };
  }
  return { valid: true, normalized };
}
