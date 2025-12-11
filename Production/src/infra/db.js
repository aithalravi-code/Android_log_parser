// IndexedDB wrapper for log viewer persistence

const DB_NAME = 'logViewerDB';
const DB_VERSION = 2;
const LOG_STORE_NAME = 'logStore';
const BTSNOOP_STORE_NAME = 'btsnoopStore';

let db = null;

/**
 * Open the IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject('Error opening IndexedDB');
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
                db.createObjectStore(LOG_STORE_NAME, { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains(BTSNOOP_STORE_NAME)) {
                const btsnoopStore = db.createObjectStore(BTSNOOP_STORE_NAME, { keyPath: 'number' });
                btsnoopStore.createIndex('tags', 'tags', { multiEntry: true });
            }
        };
    });
}

/**
 * Perform a database action (get or put)
 * @param {string} type - 'readonly' or 'readwrite'
 * @param {string} key - The key to get/put
 * @param {*} value - The value to put (optional for readonly)
 * @returns {Promise<*>}
 */
function dbAction(type, key, value = null) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not open');
        const transaction = db.transaction([LOG_STORE_NAME], type);
        const store = transaction.objectStore(LOG_STORE_NAME);
        const request = type === 'readwrite' ? store.put({ key, value }) : store.get(key);
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = (event) => reject('DB transaction error: ' + event.target.error);
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
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not open');
        // Get all store names from the database
        const storeNames = Array.from(db.objectStoreNames);
        const transaction = db.transaction(storeNames, 'readwrite');
        storeNames.forEach(name => transaction.objectStore(name).clear());
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject('DB clear error: ' + event.target.error);
    });
};

/**
 * Get the database instance
 * @returns {IDBDatabase|null}
 */
export const getDb = () => db;

/**
 * Get store names
 */
export const STORES = {
    LOG: LOG_STORE_NAME,
    BTSNOOP: BTSNOOP_STORE_NAME
};
