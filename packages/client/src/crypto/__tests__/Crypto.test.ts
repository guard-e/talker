import {
  SignalProtocolAddress,
  DeviceType,
  KeyHelper
} from '@privacyresearch/libsignal-protocol-typescript';
import { InMemorySignalProtocolStore } from '../SignalStore';
import { KeyManager } from '../KeyManager';
import { MessageEncryptor } from '../MessageEncryptor';

describe('Crypto Layer', () => {
  it('should encrypt and decrypt a message between Alice and Bob', async () => {
    // 1. Setup Alice
    const aliceStore = new InMemorySignalProtocolStore();
    const aliceKeyManager = new KeyManager(aliceStore);
    const aliceAddress = new SignalProtocolAddress('alice', 1);
    await aliceKeyManager.generateIdentity();
    const aliceEncryptor = new MessageEncryptor(aliceStore, aliceAddress);

    // 2. Setup Bob
    const bobStore = new InMemorySignalProtocolStore();
    const bobKeyManager = new KeyManager(bobStore);
    const bobAddress = new SignalProtocolAddress('bob', 1);
    await bobKeyManager.generateIdentity();
    
    // Bob publishes keys (simulated)
    const bobPreKeys = await bobKeyManager.generatePreKeys(0, 1);
    const bobSignedPreKey = await bobKeyManager.generateSignedPreKey(
      (await bobStore.getIdentityKeyPair())!,
      1
    );
    const bobIdentityKeyPair = (await bobStore.getIdentityKeyPair())!;

    // Bob's bundle that Alice downloads
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

    // 3. Alice builds session
    await aliceEncryptor.buildSession(bobAddress, bobBundle);

    // 4. Alice encrypts
    const plaintext = new TextEncoder().encode('Hello Bob!');
    const ciphertext = await aliceEncryptor.encrypt(bobAddress, plaintext);

    // 5. Bob decrypts
    // Bob needs to process the incoming message. 
    // In a real scenario, the session is created on Bob's side when he processes the PreKeyWhisperMessage.
    const bobEncryptor = new MessageEncryptor(bobStore, bobAddress);
    const decrypted = await bobEncryptor.decrypt(aliceAddress, ciphertext);

    expect(new TextDecoder().decode(decrypted)).toBe('Hello Bob!');
  });
});
