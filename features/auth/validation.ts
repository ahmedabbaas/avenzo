export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_MAX_LENGTH = 80;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 1024;
export const EMAIL_MAX_LENGTH = 254;
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(value: string) {
  return value
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9._]/g, "")
    .toLowerCase()
    .slice(0, USERNAME_MAX_LENGTH);
}

export function isValidUsername(value: string) {
  return USERNAME_PATTERN.test(value);
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string) {
  return (
    value.length > 0 &&
    value.length <= EMAIL_MAX_LENGTH &&
    EMAIL_PATTERN.test(value)
  );
}

export function isValidDisplayName(value: string) {
  const clean = value.trim();
  return clean.length > 0 && clean.length <= DISPLAY_NAME_MAX_LENGTH;
}

export function isValidPassword(value: string) {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH
  );
}

export function isValidAvatar(file: File | null) {
  if (!file) return true;
  return file.type.startsWith("image/") && file.size <= AVATAR_MAX_BYTES;
}
