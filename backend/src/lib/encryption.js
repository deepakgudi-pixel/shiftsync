const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

const encrypt = (text) => {
  if (!text) return text;
  const keyStr = process.env.ENCRYPTION_KEY;
  
  // Safety check: key must be a 64-char hex string
  if (!keyStr || keyStr.length !== 64) {
    console.error("ShiftSync Crypto: ENCRYPTION_KEY missing or invalid length. Messaging will be plain-text.");
    return text;
  }

  const key = Buffer.from(keyStr, 'hex');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Store as iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

const decrypt = (input) => {
  try {
    const secret = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const segments = input.split(':');

    if (segments.length !== 3) return input;

    const [ivHex, tagHex, cipherHex] = segments;

    const decipher = crypto.createDecipheriv(ALGORITHM, secret, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    const decrypted = Buffer.concat([
      decipher.update(cipherHex, 'hex'),
      decipher.final()
    ]);

    return decrypted.toString('utf8');
  } catch (e) {
    console.error("ShiftSync Secure Module - Decrypt Fault:", e.message);
    return input;
  }
};

module.exports = { encrypt, decrypt };