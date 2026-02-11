import { FileEncryptor } from '../FileEncryptor';
import * as fc from 'fast-check';
import { webcrypto } from 'crypto';

// Polyfill for Node.js environment
if (!globalThis.crypto) {
  // @ts-ignore
  globalThis.crypto = webcrypto;
}
if (typeof window === 'undefined') {
  // @ts-ignore
  global.window = { crypto: webcrypto };
} else if (!window.crypto) {
   // @ts-ignore
  window.crypto = webcrypto;
}

describe('FileEncryptor', () => {
  const encryptor = new FileEncryptor();

  it('should encrypt and decrypt a small file', async () => {
    const data = new Uint8Array([1, 2, 3, 4, 5]);
    const encrypted = await encryptor.encrypt(data);
    
    expect(encrypted.chunks.length).toBe(1);
    expect(encrypted.key).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    
    const decrypted = await encryptor.decrypt(encrypted);
    expect(decrypted).toEqual(data);
  });

  it('should encrypt and decrypt a large file (multiple chunks)', async () => {
    // 64KB + 10 bytes
    const size = 64 * 1024 + 10;
    const data = new Uint8Array(size);
    for(let i=0; i<size; i++) data[i] = i % 256;
    
    const encrypted = await encryptor.encrypt(data);
    
    expect(encrypted.chunks.length).toBe(2);
    
    const decrypted = await encryptor.decrypt(encrypted);
    expect(decrypted).toEqual(data);
  });

  it('should satisfy round-trip property', async () => {
    await fc.assert(
      fc.asyncProperty(fc.uint8Array({ minLength: 0, maxLength: 200000 }), async (data) => {
        const encrypted = await encryptor.encrypt(data);
        const decrypted = await encryptor.decrypt(encrypted);
        expect(decrypted).toEqual(data);
      }),
      { numRuns: 20 } // Keep it fast
    );
  });

  // Property 2: Round-trip шифрование файлов
  it('should encrypt and decrypt files with various sizes and patterns (Property 2)', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uint8Array({ minLength: 0, maxLength: 100000 }),
        fc.uint8Array({ minLength: 0, maxLength: 100000 }),
        async (data1, data2) => {
          // Test first file
          const encrypted1 = await encryptor.encrypt(data1);
          const decrypted1 = await encryptor.decrypt(encrypted1);
          expect(decrypted1).toEqual(data1);
          
          // Test second file
          const encrypted2 = await encryptor.encrypt(data2);
          const decrypted2 = await encryptor.decrypt(encrypted2);
          expect(decrypted2).toEqual(data2);
          
          // Verify encryption produces different results for different inputs
          if (data1.length !== data2.length || 
              !Buffer.from(data1).equals(Buffer.from(data2))) {
            // Different inputs should produce different encrypted outputs
            expect(encrypted1.key).not.toEqual(encrypted2.key);
            expect(encrypted1.iv).not.toEqual(encrypted2.iv);
          }
          
          // Verify chunk structure
          const expectedChunks1 = Math.ceil(data1.length / FileEncryptor.CHUNK_SIZE);
          expect(encrypted1.chunks.length).toBe(expectedChunks1);
          
          const expectedChunks2 = Math.ceil(data2.length / FileEncryptor.CHUNK_SIZE);
          expect(encrypted2.chunks.length).toBe(expectedChunks2);
          
          // Verify original size is preserved
          expect(encrypted1.originalSize).toBe(data1.length);
          expect(encrypted2.originalSize).toBe(data2.length);
        }
      ),
      { numRuns: 10 }
    );
  });
});
