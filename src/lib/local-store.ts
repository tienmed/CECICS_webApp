import fs from 'fs';
import path from 'path';
import os from 'os';
import { idFieldOf, type Rec, type TableName } from '@/core/schema';
import type { DataStore } from '@/core/mutations';
import type { DatabaseSnapshot } from '@/core/types';
import { buildMockSeed } from './mock-seed';

function getDbPath(): string {
  if (process.env.DATA_PATH) return process.env.DATA_PATH;
  // Trên Vercel hoặc AWS Lambda, process.cwd() là hệ thống tệp chỉ đọc. Chuyển sang os.tmpdir().
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(os.tmpdir(), 'cecics_data', 'db.json');
  }
  return path.join(process.cwd(), '.data', 'db.json');
}

// Bộ nhớ đệm in-memory để đảm bảo ứng dụng không bao giờ bị crash kể cả khi môi trường cấm ghi đĩa
let inMemoryDb: DatabaseSnapshot | null = null;

function ensureFile(): DatabaseSnapshot {
  if (inMemoryDb) {
    return inMemoryDb;
  }

  const dbPath = getDbPath();
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf8');
      inMemoryDb = JSON.parse(raw) as DatabaseSnapshot;
      return inMemoryDb;
    }
  } catch (readErr) {
    console.warn('[local-store] Cảnh báo đọc tệp db.json, chuyển sang nạp mock seed:', readErr);
  }

  const seed = buildMockSeed();
  inMemoryDb = seed;
  try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2), 'utf8');
  } catch (writeErr) {
    console.warn('[local-store] Cảnh báo: Không thể ghi đĩa (read-only filesystem). Tiếp tục với in-memory store:', writeErr);
  }

  return inMemoryDb;
}

export function resetLocalDb(): DatabaseSnapshot {
  const seed = buildMockSeed();
  inMemoryDb = seed;
  try {
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(seed, null, 2), 'utf8');
  } catch (err) {
    console.warn('[local-store] Reset db in-memory fallback:', err);
  }
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
    try {
      const dbPath = getDbPath();
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
    } catch (writeErr) {
      console.warn('[local-store] Cảnh báo: Không thể đồng bộ thay đổi ra đĩa. Dữ liệu đã lưu in-memory:', writeErr);
    }
    return result;
  });
  writeQueue = task.catch(() => undefined);
  return task;
}

export function readLocalDb(): DatabaseSnapshot {
  return ensureFile();
}
