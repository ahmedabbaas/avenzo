import {
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
} from "../features/auth/validation.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("normalizes AVENZO usernames consistently", () => {
  assert(normalizeUsername("@Ahmed_Abbas") === "ahmed_abbas", "username should normalize");
  assert(normalizeUsername("@@A.B") === "a.b", "leading @ characters should be removed");
});

Deno.test("accepts only valid AVENZO usernames", () => {
  assert(isValidUsername("ahmed.abbas"), "valid username rejected");
  assert(isValidUsername("a_b"), "minimum valid username rejected");
  assert(!isValidUsername("ab"), "short username accepted");
  assert(!isValidUsername("Ahmed"), "uppercase username should not pass normalized rule");
  assert(!isValidUsername("ahmed-abbas"), "hyphen should not be accepted");
});

Deno.test("normalizes and validates email addresses", () => {
  const email = normalizeEmail("  TEST@Example.COM ");
  assert(email === "test@example.com", "email should normalize");
  assert(isValidEmail(email), "valid email rejected");
  assert(!isValidEmail("not-an-email"), "invalid email accepted");
});

Deno.test("enforces AVENZO password bounds", () => {
  assert(!isValidPassword("1234567"), "short password accepted");
  assert(isValidPassword("12345678"), "minimum password rejected");
  assert(!isValidPassword("x".repeat(1025)), "oversized password accepted");
});

Deno.test("validates display names after trimming", () => {
  assert(isValidDisplayName("Ahmed Abbas"), "valid display name rejected");
  assert(!isValidDisplayName("   "), "blank display name accepted");
  assert(!isValidDisplayName("x".repeat(81)), "oversized display name accepted");
});
