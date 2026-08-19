/**
 * resolveCanonicalUid is the linchpin of every login path resolving to the
 * shared account after linking (see the 19 Aug 2026 bug fix: handleAuthVerify
 * didn't call this and a linked-away wallet signed back into its own empty
 * account instead of the canonical one). Covered here so a future login path
 * that forgets to call it fails a test, not just a live account.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => {
  let store = new Map<string, any>();
  return {
    reset: () => { store = new Map(); },
    seed: (path: string, data: Record<string, unknown>) => store.set(path, data),
    getFirestore: () => ({
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => {
            const path = `${name}/${id}`;
            const exists = store.has(path);
            return { exists, data: () => (exists ? { ...store.get(path) } : undefined) };
          },
        }),
      }),
    }),
  };
});

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: fake.getFirestore,
}));

beforeEach(() => fake.reset());

const { resolveCanonicalUid } = await import("./store.js");

describe("resolveCanonicalUid", () => {
  it("returns the same uid when no link exists (default, pre-linking case)", async () => {
    await expect(resolveCanonicalUid("NQneverlinked")).resolves.toBe("NQneverlinked");
  });

  it("resolves to the canonical uid when this uid was folded into another", async () => {
    fake.seed("identity_links/NQsecondary", { canonicalUid: "NQcanonical", provider: "nimiq", linkedAt: 123 });
    await expect(resolveCanonicalUid("NQsecondary")).resolves.toBe("NQcanonical");
  });

  it("a canonical uid (no identity_links doc) still resolves to itself", async () => {
    // Convention: "no doc" means you ARE canonical — confirm this isn't
    // accidentally inverted.
    await expect(resolveCanonicalUid("NQcanonical")).resolves.toBe("NQcanonical");
  });
});
