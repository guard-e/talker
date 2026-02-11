import 'fake-indexeddb/auto';
import { LocalStorage, Message } from '../LocalStorage';
import * as fc from 'fast-check';
import { webcrypto } from 'crypto';

// Polyfill crypto
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

describe('LocalStorage', () => {
  const masterKey = new Uint8Array(32).fill(1); // Test key
  let storage: LocalStorage;

  beforeEach(async () => {
    // Reset DB
    // Close any previous connections if we can't ensure it
    // In fake-indexeddb we trust deleteDatabase works if connections are closed.
    
    // We assume 'storage' from previous run is closed in afterEach.
    
    const req = indexedDB.deleteDatabase('talker-db');
    await new Promise((resolve) => { req.onsuccess = resolve; req.onerror = resolve; });
    
    storage = new LocalStorage(masterKey);
  });

  afterEach(async () => {
    if (storage) {
      await storage.close();
    }
  });

  it('should save and retrieve a message', async () => {
    const msg: Message = {
      id: '1',
      sender: 'alice',
      content: 'hello',
      timestamp: Date.now()
    };
    
    await storage.saveMessage(msg);
    const retrieved = await storage.getMessages();
    
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0]).toEqual(msg);
  });

  it('should encrypt data at rest (Property 19)', async () => {
     // We can spy on encrypt
     const spy = jest.spyOn(window.crypto.subtle, 'encrypt');
     const msg: Message = {
      id: '2',
      sender: 'bob',
      content: 'secret',
      timestamp: Date.now()
    };
    await storage.saveMessage(msg);
    expect(spy).toHaveBeenCalled();
  });

  it('should handle pagination', async () => {
    // Save 10 messages
    for(let i=0; i<10; i++) {
      await storage.saveMessage({
        id: `${i}`,
        sender: 'me',
        content: `msg ${i}`,
        timestamp: 1000 + i
      });
    }
    
    // Get newest 5 (9, 8, 7, 6, 5)
    const page1 = await storage.getMessages(5, 0);
    expect(page1).toHaveLength(5);
    expect(page1[0].id).toBe('9');
    expect(page1[4].id).toBe('5');
    
    // Get next 5 (4, 3, 2, 1, 0)
    const page2 = await storage.getMessages(5, 5);
    expect(page2).toHaveLength(5);
    expect(page2[0].id).toBe('4');
    expect(page2[4].id).toBe('0');
  });

  it('should delete message (Property 8)', async () => {
    const msg: Message = { id: 'del', sender: 'x', content: 'x', timestamp: 123 };
    await storage.saveMessage(msg);
    await storage.deleteMessage('del');
    const msgs = await storage.getMessages();
    expect(msgs).toEqual([]);
  });

  it('should satisfy round-trip property (Property 19)', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.string(), fc.integer(), async (content, sender, timestamp) => {
        const id = Math.random().toString();
        const msg = { id, content, sender, timestamp };
        
        await storage.saveMessage(msg);
        
        const all = await storage.getMessages(1000);
        const found = all.find(m => m.id === id);
        expect(found).toEqual(msg);
      }),
      { numRuns: 20 }
    );
  });
});
