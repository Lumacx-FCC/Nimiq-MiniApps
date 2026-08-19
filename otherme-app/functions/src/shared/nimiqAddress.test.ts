import { describe, expect, it } from "vitest";
import { isNimiqAddress, normalizeAddress } from "./nimiqAddress.js";

describe("normalizeAddress", () => {
  it("strips whitespace and uppercases", () => {
    expect(normalizeAddress("nq52 p5jm 7t15 vfsv 9g8s uea1 7cra jvah u69f"))
      .toBe("NQ52P5JM7T15VFSV9G8SUEA17CRAJVAHU69F");
  });

  it("is idempotent on an already-normalized address", () => {
    const addr = "NQ52P5JM7T15VFSV9G8SUEA17CRAJVAHU69F";
    expect(normalizeAddress(addr)).toBe(addr);
  });
});

describe("isNimiqAddress", () => {
  it("accepts a valid 36-char NQ address with no spaces", () => {
    expect(isNimiqAddress("NQ52P5JM7T15VFSV9G8SUEA17CRAJVAHU69F")).toBe(true);
  });

  it("rejects an address with spaces (must normalize first)", () => {
    expect(isNimiqAddress("NQ52 P5JM 7T15 VFSV 9G8S UEA1 7CRA JVAH U69F")).toBe(false);
  });

  it("rejects the wrong length", () => {
    expect(isNimiqAddress("NQ52P5JM7T15VFSV9G8SUEA17CRAJVAHU69")).toBe(false);
  });

  it("rejects a non-NQ prefix", () => {
    expect(isNimiqAddress("XX52P5JM7T15VFSV9G8SUEA17CRAJVAHU69F")).toBe(false);
  });

  it("rejects lowercase (normalize uppercases first)", () => {
    expect(isNimiqAddress("nq52p5jm7t15vfsv9g8suea17crajvahu69f")).toBe(false);
  });
});
