import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decryptBackupPayload,
  encryptBackupPayload,
  hashPin,
  verifyPin,
} from './cryptoVault.ts';

test('hashPin and verifyPin authenticate valid PIN and reject wrong PIN', async () => {
  const record = await hashPin('2468');
  assert.equal(await verifyPin('2468', record.hashBase64, record.saltBase64), true);
  assert.equal(await verifyPin('1357', record.hashBase64, record.saltBase64), false);
});

test('encryptBackupPayload and decryptBackupPayload round-trip JSON and fail on wrong passphrase', async () => {
  const payload = JSON.stringify({ app: 'Timeline', count: 3, note: 'ذكرى مهمة' });
  const envelope = await encryptBackupPayload(payload, 'secret-pass-2026');
  assert.equal(envelope.format, 'timeline-encrypted-backup');
  assert.ok(!envelope.ciphertext.includes('ذكرى'));

  const decrypted = await decryptBackupPayload(envelope, 'secret-pass-2026');
  assert.equal(decrypted, payload);

  await assert.rejects(
    () => decryptBackupPayload(envelope, 'wrong-pass'),
    /غير صحيحة/,
  );
});
