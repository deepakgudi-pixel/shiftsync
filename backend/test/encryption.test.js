const test = require("node:test");
const assert = require("node:assert/strict");

const { encrypt, decrypt } = require("../src/lib/encryption");

const TEST_KEY = "3fa21da4b4d74e1ed33427cdf3dfaca25443c1984b9ec5ff7b17f047027a8e13";

test("encrypt returns encrypted string for valid input", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const result = encrypt("Hello World");
  assert.ok(typeof result === "string");
  assert.ok(result.length > 0);
  assert.ok(result.includes(":"));
});

test("decrypt returns original text after encryption", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const original = "Secret Message 123";
  const encrypted = encrypt(original);
  const decrypted = decrypt(encrypted);
  assert.equal(decrypted, original);
});

test("encrypt produces different ciphertext for same input", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const enc1 = encrypt("Same Text");
  const enc2 = encrypt("Same Text");
  assert.notEqual(enc1, enc2);
});

test("encrypt returns null/undefined input unchanged", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  assert.equal(encrypt(null), null);
  assert.equal(encrypt(undefined), undefined);
  assert.equal(encrypt(""), "");
});

test("decrypt returns input unchanged if not encrypted format", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  assert.equal(decrypt("plain text"), "plain text");
});

test("decrypt handles malformed encrypted string", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const result = decrypt("invalid:format:but:not:valid:hex");
  assert.ok(typeof result === "string");
});

test("encrypt output contains IV, auth tag, and ciphertext", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const encrypted = encrypt("Test");
  const parts = encrypted.split(":");
  assert.equal(parts.length, 3);
  assert.equal(parts[0].length, 24);
  assert.equal(parts[1].length, 32);
});

test("encryption uses AES-256-GCM", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const encrypted = encrypt("AES test");
  const parts = encrypted.split(":");
  const iv = Buffer.from(parts[0], "hex");
  assert.equal(iv.length, 12);
});

test("encrypt handles unicode characters", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const original = "Hello \u4e16\u754c \ud83c\udf0d";
  const encrypted = encrypt(original);
  const decrypted = decrypt(encrypted);
  assert.equal(decrypted, original);
});

test("encrypt handles long strings", () => {
  process.env.ENCRYPTION_KEY = TEST_KEY;
  const original = "A".repeat(10000);
  const encrypted = encrypt(original);
  const decrypted = decrypt(encrypted);
  assert.equal(decrypted, original);
});

test("encrypt throws when ENCRYPTION_KEY is missing", () => {
  const prevKey = process.env.ENCRYPTION_KEY;
  delete process.env.ENCRYPTION_KEY;
  assert.throws(() => encrypt("test"), /ENCRYPTION_KEY is missing/);
  process.env.ENCRYPTION_KEY = prevKey;
});

test("encrypt throws when ENCRYPTION_KEY is invalid length", () => {
  const prevKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = "tooshort";
  assert.throws(() => encrypt("test"), /must be a 64-character hex string/);
  process.env.ENCRYPTION_KEY = prevKey;
});
