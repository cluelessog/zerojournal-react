import { getDB } from './db'

/**
 * Retrieve a setting value from the IndexedDB settings store.
 * Returns undefined if the key does not exist.
 */
export async function getSettings<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB()
  const value = await db.get('settings', key)
  return value as T | undefined
}

/**
 * Persist a setting value to the IndexedDB settings store.
 * Setting a value to null removes it from the store.
 */
export async function setSettings(key: string, value: unknown): Promise<void> {
  const db = await getDB()
  if (value === null || value === undefined) {
    await db.delete('settings', key)
  } else {
    await db.put('settings', value, key)
  }
}
