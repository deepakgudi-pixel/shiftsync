const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM

const getEncryptionKey = () => {
  const keyStr = process.env.ENCRYPTION_KEY?.trim();

  if (!keyStr) {
    throw new Error("ENCRYPTION_KEY is missing");
  }

  if (!/^[0-9a-fA-F]{64}$/.test(keyStr)) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string");
  }

  return Buffer.from(keyStr, 'hex');
};

const encrypt = (text) => {
  if (!text) return text;
  const key = getEncryptionKey();
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
    const segments = input.split(':');

    if (segments.length !== 3) return input;

    const secret = getEncryptionKey();
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
