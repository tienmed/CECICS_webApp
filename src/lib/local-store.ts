import fs from 'fs';
import path from 'path';
import { idFieldOf, type Rec, type TableName } from '@/core/schema';
import type { DataStore } from '@/core/mutations';
import type { DatabaseSnapshot } from '@/core/types';
import { buildMockSeed } from './mock-seed';

const DB_PATH = path.join(process.cwd(), '.data', 'db.json');

function ensureFile(): DatabaseSnapshot {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const seed = buildMockSeed();
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf8');
    return seed;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  return JSON.parse(raw) as DatabaseSnapshot;
}

export function resetLocalDb(): DatabaseSnapshot {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const seed = buildMockSeed();
  fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), 'utf8');
  return seed;
}

// Khóa tuần tự trong tiến trình để mô phỏng LockService ở chế độ Local
let writeQueue: Promise<unknown> = Promise.resolve();

export function withLocalLock<T>(fn: (store: DataStore) => T): Promise<T> {
  const task = writeQueue.then(() => {
    const db = ensureFile();
    const store: DataStore = {
      getAll: () => db,
      append<K extends TableName>(table: K, record: Rec<K>) {
        (db[table] as Rec<K>[]).push(record);
      },
      update<K extends TableName>(table: K, id: string, patch: Partial<Rec<K>>): Rec<K> {
        const idField = idFieldOf(table);
        const list = db[table] as Record<string, unknown>[];
        const idx = list.findIndex((r) => String(r[idField]) === String(id));
        if (idx === -1) throw new Error(`NOT_FOUND:${table}:${id}`);
        const merged = { ...list[idx], ...patch };
        list[idx] = merged;
        return merged as Rec<K>;
      },
      removeByPredicate<K extends TableName>(table: K, predicate: (rec: Rec<K>) => boolean) {
        (db[table] as Rec<K>[]) = (db[table] as Rec<K>[]).filter((r) => !predicate(r));
      },
    };
    const result = fn(store);
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
    return result;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export function readLocalDb(): DatabaseSnapshot {
  return ensureFile();
}
