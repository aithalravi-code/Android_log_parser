import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openDb, saveData, loadData, clearData, getDb, STORES } from '../../Production/src/infra/db.js';
import 'fake-indexeddb/auto'; // Automatically mocks indexedDB

describe('Database Infrastructure (db.js)', () => {

    beforeEach(async () => {
        // Reset DB before each test? 
        // fake-indexeddb keeps state in memory.
        // We can close and reopen or just clear.
        if (getDb()) {
            getDb().close();
        }
        await openDb();
        await clearData();
    });

    it('should open the database successfully', async () => {
        const db = getDb();
        expect(db).toBeDefined();
        expect(db.objectStoreNames.contains(STORES.LOG)).toBe(true);
        expect(db.objectStoreNames.contains(STORES.BTSNOOP)).toBe(true);
    });

    it('should save and load data', async () => {
        const key = 'testKey';
        const value = { data: 'some data' };

        await saveData(key, value);
        const loaded = await loadData(key);

        expect(loaded).toBeDefined();
        expect(loaded.key).toBe(key);
        expect(loaded.value).toEqual(value);
    });

    it('should return undefined for non-existent data', async () => {
        const loaded = await loadData('nonExistent');
        expect(loaded).toBeUndefined();
    });

    it('should clear data', async () => {
        await saveData('key1', 'val1');
        await clearData();
        const loaded = await loadData('key1');
        expect(loaded).toBeUndefined();
    });

    it('should upgrade database structure if needed', async () => {
        // difficult to test upgrade directly with fake-indexeddb auto without manual control, 
        // but checking objectStoreNames confirms successful open/upgrade.
        const db = getDb();
        expect(db.objectStoreNames.length).toBeGreaterThanOrEqual(2);
    });
});
