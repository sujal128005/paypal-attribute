// Tiny persistent store: an in-memory document persisted atomically to data/db.json.
// All writes go through `mutate`, which serialises them so the ledger can never interleave.
// Swappable for Postgres without touching callers: every access goes through this module.
import fs from "node:fs";
import path from "node:path";
import type { Database } from "./types";
import { buildSeed, SEED_VERSION } from "./seed";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

type Holder = { db?: Database; chain: Promise<unknown> };
const g = globalThis as unknown as { __attributeStore?: Holder };
const holder: Holder = (g.__attributeStore ??= { chain: Promise.resolve() });

function persist(db: Database) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    // Read-only file systems still work: state lives in memory for the process lifetime.
    console.warn("[store] could not persist database:", (err as Error).message);
  }
}

function load(): Database {
  if (holder.db) return holder.db;
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as Database;
    if (raw.version === SEED_VERSION) {
      holder.db = raw;
      return raw;
    }
  } catch {
    /* first boot */
  }
  const fresh = buildSeed();
  holder.db = fresh;
  persist(fresh);
  return fresh;
}

/** Read-only snapshot of the current state. */
export function db(): Database {
  return load();
}

/** Serialised, persisted write. The callback may be async and may return a value. */
export function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = holder.chain.then(async () => {
    const state = load();
    const result = await fn(state);
    persist(state);
    return result;
  });
  holder.chain = run.catch(() => undefined);
  return run;
}

export function resetDatabase(): Promise<void> {
  return mutate((state) => {
    const fresh = buildSeed();
    Object.assign(state, fresh);
  });
}

export function nextCounter(state: Database, key: string) {
  state.counters[key] = (state.counters[key] ?? 0) + 1;
  return state.counters[key];
}
