import { describe, expect, it } from "vitest";
import { searchWords } from "../src/lib/phoneSearch.js";

describe("searchWords", () => {
  it("keeps a run of phone-like words together as one word", () => {
    expect(searchWords("Marko 064 123 4567")).toEqual(["Marko", "064 123 4567"]);
    expect(searchWords("+381 64 1206")).toEqual(["+381 64 1206"]);
  });

  it("splits words that are not phone-like", () => {
    expect(searchWords("marko example.com")).toEqual(["marko", "example.com"]);
    expect(searchWords("customer 01")).toEqual(["customer", "01"]);
  });

  it("starts a new run after each word that is not phone-like", () => {
    expect(searchWords("064 Marko 123")).toEqual(["064", "Marko", "123"]);
  });

  it("makes no empty words from extra whitespace", () => {
    expect(searchWords("  Marko   064  123 ")).toEqual(["Marko", "064 123"]);
    expect(searchWords("   ")).toEqual([]);
  });
});
