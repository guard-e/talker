import { KeyManager } from '../KeyManager';
import { InMemorySignalProtocolStore } from '../SignalStore';
import * as fc from 'fast-check';

describe('KeyManager Property Tests', () => {
  it('should generate unique pre-keys', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (count) => {
        const store = new InMemorySignalProtocolStore();
        const manager = new KeyManager(store);
        
        const preKeys = await manager.generatePreKeys(0, count);
        
        // Check count
        expect(preKeys.length).toBe(count);
        
        // Check uniqueness of IDs
        const ids = new Set(preKeys.map(k => k.keyId));
        expect(ids.size).toBe(count);
        
        // Check uniqueness of public keys
        const pubKeys = new Set(preKeys.map(k => Buffer.from(k.keyPair.pubKey).toString('hex')));
        expect(pubKeys.size).toBe(count);
      }),
      { numRuns: 10 } // Generating keys is expensive
    );
  });

  it('should generate unique signed pre-keys', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 20 }), async (count) => {
        const store = new InMemorySignalProtocolStore();
        const manager = new KeyManager(store);
        await manager.generateIdentity();
        const identity = (await store.getIdentityKeyPair())!;
        
        const signedKeys = [];
        for(let i=0; i<count; i++) {
          signedKeys.push(await manager.generateSignedPreKey(identity, i));
        }
        
        // Check uniqueness of IDs
        const ids = new Set(signedKeys.map(k => k.keyId));
        expect(ids.size).toBe(count);
        
        // Check uniqueness of signatures (should be different because signed data includes ID?)
        // Actually signature is on public key. If public key is new for each call?
        // libsignal generateSignedPreKey generates a new key pair each time.
        const pubKeys = new Set(signedKeys.map(k => Buffer.from(k.keyPair.pubKey).toString('hex')));
        expect(pubKeys.size).toBe(count);
      }),
      { numRuns: 5 }
    );
  });

  // Property 4: Уникальность криптографических ключей (Requirements 1.4, 9.1)
  it('should generate unique cryptographic keys (Property 4)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 10 }), async (count) => {
        const store = new InMemorySignalProtocolStore();
        const manager = new KeyManager(store);
        
        // Generate multiple identity keys
        const identityKeys = [];
        for (let i = 0; i < count; i++) {
          await manager.generateIdentity();
          const identity = await store.getIdentityKeyPair();
          if (identity) {
            identityKeys.push(Buffer.from(identity.pubKey).toString('hex'));
          }
          // Reset store for next iteration
          await store.clear();
        }
        
        // All identity keys should be unique
        expect(new Set(identityKeys).size).toBe(count);
        
        // Generate pre-keys and verify uniqueness
        await manager.generateIdentity();
        const preKeys = await manager.generatePreKeys(0, count);
        const preKeyPubKeys = preKeys.map(k => Buffer.from(k.keyPair.pubKey).toString('hex'));
        expect(new Set(preKeyPubKeys).size).toBe(count);
        
        // Generate signed pre-keys and verify uniqueness
        const identity = (await store.getIdentityKeyPair())!;
        const signedPreKeys = [];
        for (let i = 0; i < count; i++) {
          signedPreKeys.push(await manager.generateSignedPreKey(identity, i));
        }
        const signedPreKeyPubKeys = signedPreKeys.map(k => Buffer.from(k.keyPair.pubKey).toString('hex'));
        expect(new Set(signedPreKeyPubKeys).size).toBe(count);
      }),
      { numRuns: 5 }
    );
  });
});
