/**
 * Idempotency + balance-correctness tests for the credits ledger — the
 * money-critical logic. Mocks "firebase-admin/firestore" with a small
 * in-memory fake (no emulator, no network) so these run fast and
 * deterministically. See the vi.hoisted() block below for why the fake is
 * defined inline rather than imported: vi.mock() factories can only close
 * over vi.hoisted() values, not regular module-scope imports.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  const INCREMENT = Symbol("increment");
  let store = new Map<string, any>();

  function makeDocRef(path: string): any {
    return {
      path,
      collection: (name: string) => makeCollectionRef(`${path}/${name}`),
      get: async () => {
        const exists = store.has(path);
        return { exists, data: () => (exists ? { ...store.get(path) } : undefined) };
      },
    };
  }
  function makeCollectionRef(path: string): any {
    return { doc: (id: string) => makeDocRef(`${path}/${id}`) };
  }

  class FakeTransaction {
    async get(ref: any) {
      const exists = store.has(ref.path);
      return { exists, data: () => (exists ? { ...store.get(ref.path) } : undefined) };
    }

    set(ref: any, data: Record<string, unknown>, opts?: { merge?: boolean }) {
      const existing = store.get(ref.path);
      if (opts?.merge && existing)
        store.set(ref.path, { ...existing, ...data });
      else
        store.set(ref.path, { ...data });
    }

    update(ref: any, data: Record<string, unknown>) {
      const existing = store.get(ref.path) ?? {};
      const next = { ...existing };
      for (const [key, value] of Object.entries(data)) {
        if (value && typeof value === "object" && INCREMENT in (value as any))
          next[key] = (existing[key] ?? 0) + (value as any)[INCREMENT];
        else
          next[key] = value;
      }
      store.set(ref.path, next);
    }
  }

  return {
    reset: () => { store = new Map(); },
    seed: (path: string, data: Record<string, unknown>) => store.set(path, data),
    peek: (path: string) => store.get(path),
    getFirestore: () => ({
      collection: (name: string) => makeCollectionRef(name),
      runTransaction: async (fn: (tx: FakeTransaction) => Promise<any>) => fn(new FakeTransaction()),
    }),
    FieldValue: { increment: (n: number) => ({ [INCREMENT]: n }) },
  };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: fake.getFirestore,
  FieldValue: fake.FieldValue,
}));

beforeEach(() => fake.reset());

const { grantPromo, recordPurchase, spend } = await import("./store.js");

describe("spend", () => {
  it("rejects when the balance is insufficient", async () => {
    fake.seed("users/NQtest", { balance: 5 });
    const result = await spend("NQtest", 10, "test-spend");
    expect(result).toEqual({ ok: false, balance: 5 });
    expect(fake.peek("users/NQtest").balance).toBe(5); // untouched
  });

  it("debits atomically when the balance is sufficient", async () => {
    fake.seed("users/NQtest", { balance: 10 });
    const result = await spend("NQtest", 4, "test-spend");
    expect(result).toEqual({ ok: true, balance: 6 });
    expect(fake.peek("users/NQtest").balance).toBe(6);
  });

  it("treats a missing user doc as a zero balance", async () => {
    const result = await spend("NQghost", 1, "test-spend");
    expect(result).toEqual({ ok: false, balance: 0 });
  });
});

describe("recordPurchase — idempotent by txHash", () => {
  it("grants credits on the first call", async () => {
    const result = await recordPurchase("NQtest", "0xhash1", 100, "usdt", 5);
    expect(result).toEqual({ balance: 100, alreadyRecorded: false });
  });

  it("does NOT double-credit a replayed txHash", async () => {
    const first = await recordPurchase("NQtest", "0xhash1", 100, "usdt", 5);
    const second = await recordPurchase("NQtest", "0xhash1", 100, "usdt", 5);
    expect(first.alreadyRecorded).toBe(false);
    expect(second).toEqual({ balance: 100, alreadyRecorded: true });
    expect(fake.peek("users/NQtest").balance).toBe(100); // not 200
  });

  it("a different txHash for the same address grants again", async () => {
    await recordPurchase("NQtest", "0xhash1", 100, "usdt", 5);
    const second = await recordPurchase("NQtest", "0xhash2", 50, "usdt", 2.5);
    expect(second).toEqual({ balance: 150, alreadyRecorded: false });
  });
});

describe("grantPromo — idempotent by dedupeKey", () => {
  it("grants credits on the first call", async () => {
    const result = await grantPromo("NQwinner", 1000, "contest prize", "contest2026-NQwinner");
    expect(result).toEqual({ balance: 1000, alreadyGranted: false });
  });

  it("does NOT double-credit a retried grant with the same dedupeKey", async () => {
    const first = await grantPromo("NQwinner", 1000, "contest prize", "contest2026-NQwinner");
    const second = await grantPromo("NQwinner", 1000, "contest prize", "contest2026-NQwinner");
    expect(first.alreadyGranted).toBe(false);
    expect(second).toEqual({ balance: 1000, alreadyGranted: true });
    expect(fake.peek("users/NQwinner").balance).toBe(1000); // not 2000
  });

  it("a different dedupeKey for the same address grants again", async () => {
    await grantPromo("NQwinner", 1000, "contest prize", "contest2026-NQwinner");
    const second = await grantPromo("NQwinner", 500, "support credit", "support-ticket-42");
    expect(second).toEqual({ balance: 1500, alreadyGranted: false });
  });

  it("adds to an existing balance rather than replacing it", async () => {
    fake.seed("users/NQtest", { balance: 25 });
    const result = await grantPromo("NQtest", 100, "note", "dedupe-1");
    expect(result).toEqual({ balance: 125, alreadyGranted: false });
  });
});
