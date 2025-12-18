// IndexedDB wrapper for log viewer persistence


console.log('[DB] Module Loaded');
const DB_NAME = 'logViewerDB';
const DB_VERSION = 2;
const LOG_STORE_NAME = 'logStore';
const BTSNOOP_STORE_NAME = 'btsnoopStore';

// Wrap db in object to prevent minification issues
const state = { db: null };

/**
 * Open the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
// Promise to track the opening process
let openDbPromise = null;

/**
 * Open the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export function openDb() {
    if (state.db) return Promise.resolve(state.db);
    if (openDbPromise) return openDbPromise;

    openDbPromise = new Promise((resolve, reject) => {
        console.log('[DB] Opening IndexedDB ' + DB_NAME + ' v' + DB_VERSION);
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => {
            console.error('[DB] Open Request Error', event.target.error);
            openDbPromise = null;
            reject('Error opening IndexedDB: ' + event.target.error);
        };
        request.onsuccess = (event) => {
            console.log('[DB] Open Success');
            state.db = event.target.result;
            state.db.onclose = () => {
                console.warn('[DB] Connection Closed');
                state.db = null;
                openDbPromise = null;
            };
            state.db.onversionchange = (event) => {
                console.warn('[DB] Version Change detected (newVersion: ' + event.newVersion + ') - Closing Connection');
                state.db.close();
                state.db = null;
                openDbPromise = null;
            };
            resolve(state.db);
        };
        request.onupgradeneeded = (event) => {
            console.log('[DB] Upgrade Needed');
            const database = event.target.result;
            if (!database.objectStoreNames.contains(LOG_STORE_NAME)) {
                database.createObjectStore(LOG_STORE_NAME, { keyPath: 'key' });
            }
            if (!database.objectStoreNames.contains(BTSNOOP_STORE_NAME)) {
                const btsnoopStore = database.createObjectStore(BTSNOOP_STORE_NAME, { keyPath: 'number' });
                btsnoopStore.createIndex('tags', 'tags', { multiEntry: true });
            }
        };
    });

    return openDbPromise;
}

/**
 * Get the database instance
 * @returns {IDBDatabase|null}
 */
export const getDb = () => state.db;

/**
 * Perform a database action (get or put)
 * @param {string} type - 'readonly' or 'readwrite'
 * @param {string} key - The key to get/put
 * @param {*} value - The value to put (optional for readonly)
 * @returns {Promise<*>}
 */
function dbAction(type, key, value = null) {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDb();
            const transaction = database.transaction([LOG_STORE_NAME], type);
            const store = transaction.objectStore(LOG_STORE_NAME);
            const request = type === 'readwrite' ? store.put({ key, value }) : store.get(key);

            // For get requests, capture result on success
            let result;
            request.onsuccess = (e) => {
                result = e.target.result;
            };

            transaction.oncomplete = () => resolve(result || request.result);
            transaction.onerror = (event) => reject('DB transaction error: ' + event.target.error);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Save data to IndexedDB
 * @param {string} key
 * @param {*} value
 * @returns {Promise<*>}
 */
export const saveData = (key, value) => dbAction('readwrite', key, value);

/**
 * Load data from IndexedDB
 * @param {string} key
 * @returns {Promise<*>}
 */
export const loadData = (key) => dbAction('readonly', key);

/**
 * Clear all data from IndexedDB
 * @returns {Promise<void>}
 */
export const clearData = () => {
    return new Promise(async (resolve, reject) => {
        try {
            const database = await openDb();
            // Get all store names from the database
            const storeNames = Array.from(database.objectStoreNames);
            if (storeNames.length === 0) {
                resolve();
                return;
            }
            const transaction = database.transaction(storeNames, 'readwrite');
            storeNames.forEach(name => transaction.objectStore(name).clear());
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject('DB clear error: ' + event.target.error);
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Close the database connection and reset state
 * @returns {Promise<void>}
 */
export const closeDb = () => {
    return new Promise((resolve) => {
        if (state.db) {
            console.log('[DB] Closing database connection');
            state.db.close();
            state.db = null;
            openDbPromise = null;
            console.log('[DB] Database connection closed and state reset');
        } else {
            console.log('[DB] No database connection to close');
        }
        resolve();
    });
};

/**
 * Delete the entire IndexedDB database
 * @returns {Promise<void>}
 */
export const deleteDatabase = () => {
    return new Promise(async (resolve, reject) => {
        try {
            // Close the connection first
            await closeDb();

            console.log('[DB] Deleting database:', DB_NAME);
            const request = indexedDB.deleteDatabase(DB_NAME);

            request.onsuccess = () => {
                console.log('[DB] Database deleted successfully');
                resolve();
            };

            request.onerror = (event) => {
                console.error('[DB] Error deleting database:', event.target.error);
                reject('Error deleting database: ' + event.target.error);
            };

            request.onblocked = () => {
                console.warn('[DB] Database deletion blocked - other connections may be open');
                // Still resolve as the deletion will complete when other connections close
                resolve();
            };
        } catch (error) {
            console.error('[DB] Exception during database deletion:', error);
            reject(error);
        }
    });
};

/**
 * Reset the database: delete and reopen with fresh state
 * @returns {Promise<IDBDatabase>}
 */
export const resetDatabase = async () => {
    console.log('[DB] Resetting database (delete + reopen)');
    await deleteDatabase();
    // Small delay to ensure deletion completes
    await new Promise(resolve => setTimeout(resolve, 100));
    return await openDb();
};

/**
 * Get store names
 */
export const STORES = {
    LOG: LOG_STORE_NAME,
    BTSNOOP: BTSNOOP_STORE_NAME
};
