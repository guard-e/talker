import { MessageEncryptor } from '../MessageEncryptor';
import { KeyManager } from '../KeyManager';
import { InMemorySignalProtocolStore } from '../SignalStore';
import { SignalProtocolAddress, DeviceType } from '@privacyresearch/libsignal-protocol-typescript';
import * as fc from 'fast-check';

describe('MessageEncryptor Property Tests', () => {
  // Helper to setup session
  const setupSession = async () => {
    const aliceStore = new InMemorySignalProtocolStore();
    const aliceKeyManager = new KeyManager(aliceStore);
    const aliceAddress = new SignalProtocolAddress('alice', 1);
    await aliceKeyManager.generateIdentity();
    const aliceEncryptor = new MessageEncryptor(aliceStore, aliceAddress);

    const bobStore = new InMemorySignalProtocolStore();
    const bobKeyManager = new KeyManager(bobStore);
    const bobAddress = new SignalProtocolAddress('bob', 1);
    await bobKeyManager.generateIdentity();
    
    const bobPreKeys = await bobKeyManager.generatePreKeys(0, 1);
    const bobSignedPreKey = await bobKeyManager.generateSignedPreKey(
      (await bobStore.getIdentityKeyPair())!,
      1
    );
    const bobIdentityKeyPair = (await bobStore.getIdentityKeyPair())!;

    const bobBundle: DeviceType = {
      identityKey: bobIdentityKeyPair.pubKey,
      signedPreKey: {
        keyId: bobSignedPreKey.keyId,
        publicKey: bobSignedPreKey.keyPair.pubKey,
        signature: bobSignedPreKey.signature
      },
      preKey: {
        keyId: bobPreKeys[0].keyId,
        publicKey: bobPreKeys[0].keyPair.pubKey
      },
      registrationId: (await bobStore.getLocalRegistrationId())!
    };

    await aliceEncryptor.buildSession(bobAddress, bobBundle);
    const bobEncryptor = new MessageEncryptor(bobStore, bobAddress);

    return { aliceEncryptor, bobEncryptor, aliceAddress, bobAddress };
  };

  it('should encrypt and decrypt arbitrary messages (Round-trip)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 1, maxLength: 1000 }), async (message) => {
        const { aliceEncryptor, bobEncryptor, aliceAddress, bobAddress } = await setupSession();
        
        // Alice -> Bob
        const ciphertext = await aliceEncryptor.encrypt(bobAddress, message);
        const plaintext = await bobEncryptor.decrypt(aliceAddress, ciphertext);
        
        expect(plaintext).toEqual(message);
      }),
      { numRuns: 10 }
    );
  });

  it('should provide Forward Secrecy (Ratchet advances)', async () => {
    const { aliceEncryptor, bobEncryptor, aliceAddress, bobAddress } = await setupSession();
    const message = new TextEncoder().encode('secret');
    
    const ciphertext1 = await aliceEncryptor.encrypt(bobAddress, message);
    const ciphertext2 = await aliceEncryptor.encrypt(bobAddress, message);
    
    // Ciphertexts should differ (IV/Ratchet)
    expect(ciphertext1.body).not.toEqual(ciphertext2.body);
    
    // Decrypt both
    const plain1 = await bobEncryptor.decrypt(aliceAddress, ciphertext1);
    const plain2 = await bobEncryptor.decrypt(aliceAddress, ciphertext2);
    
    expect(plain1).toEqual(message);
    expect(plain2).toEqual(message);
  });

  // Property 1: Round-trip шифрование контента (Requirements 3.1, 3.2)
  it('should encrypt and decrypt arbitrary content (Property 1)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 1000 }),
        fc.uint8Array({ minLength: 1, maxLength: 1000 }),
        async (message1, message2) => {
          const { aliceEncryptor, bobEncryptor, aliceAddress, bobAddress } = await setupSession();
          
          // Encrypt and decrypt first message
          const ciphertext1 = await aliceEncryptor.encrypt(bobAddress, message1);
          const plaintext1 = await bobEncryptor.decrypt(aliceAddress, ciphertext1);
          expect(plaintext1).toEqual(message1);
          
          // Encrypt and decrypt second message
          const ciphertext2 = await aliceEncryptor.encrypt(bobAddress, message2);
          const plaintext2 = await bobEncryptor.decrypt(aliceAddress, ciphertext2);
          expect(plaintext2).toEqual(message2);
          
          // Ciphertexts should be different even for same messages
          if (message1.length === message2.length && 
              Buffer.from(message1).equals(Buffer.from(message2))) {
            // For identical messages, ciphertexts should still differ due to ratchet
            expect(ciphertext1.body).not.toEqual(ciphertext2.body);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  // Property 5: Perfect Forward Secrecy
  it('should provide Perfect Forward Secrecy (Property 5)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 1, maxLength: 100 }),
        fc.integer({ min: 2, max: 5 }),
        async (message, messageCount) => {
          const { aliceEncryptor, bobEncryptor, aliceAddress, bobAddress } = await setupSession();
          
          const ciphertexts = [];
          
          // Send multiple messages
          for (let i = 0; i < messageCount; i++) {
            ciphertexts.push(await aliceEncryptor.encrypt(bobAddress, message));
          }
          
          // All ciphertexts should be different
          const ciphertextBodies = ciphertexts.map(ct => {
            if (!ct.body) throw new Error('Ciphertext body is undefined');
            return Buffer.from(ct.body).toString('hex');
          });
          expect(new Set(ciphertextBodies).size).toBe(messageCount);
          
          // All should decrypt correctly
          for (let i = 0; i < messageCount; i++) {
            const plaintext = await bobEncryptor.decrypt(aliceAddress, ciphertexts[i]);
            expect(plaintext).toEqual(message);
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});
