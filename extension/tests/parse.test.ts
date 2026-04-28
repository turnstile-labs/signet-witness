import { describe, it, expect } from "vitest";
import {
  emailToDomain,
  isFreeMailDomain,
  FREE_MAIL_DOMAINS,
} from "../src/lib/parse";

describe("emailToDomain", () => {
  it("extracts a clean lowercase domain from a vanilla address", () => {
    expect(emailToDomain("alice@acme.com")).toBe("acme.com");
  });

  it("trims surrounding whitespace", () => {
    expect(emailToDomain("  bob@acme.com  ")).toBe("acme.com");
  });

  it("lower-cases mixed-case domains", () => {
    expect(emailToDomain("Carol@Acme.COM")).toBe("acme.com");
  });

  it("rejects strings without an @ separator", () => {
    expect(emailToDomain("acme.com")).toBeNull();
    expect(emailToDomain("plainstring")).toBeNull();
  });

  it("rejects right-hand sides without a dot", () => {
    expect(emailToDomain("alice@localhost")).toBeNull();
    expect(emailToDomain("alice@bare")).toBeNull();
  });

  it("returns null for null / undefined / empty input", () => {
    expect(emailToDomain(null)).toBeNull();
    expect(emailToDomain(undefined)).toBeNull();
    expect(emailToDomain("")).toBeNull();
    expect(emailToDomain("   ")).toBeNull();
  });

  it("rejects RFC-illegal addresses with multiple @ symbols", () => {
    // Implementation splits at the first `@` and uses the second token
    // as the domain — `"strange"` has no dot, so it correctly fails the
    // domain-shape check and returns null. Tests pin this so a future
    // refactor (e.g. switching to lastIndexOf) doesn't silently start
    // accepting malformed input.
    expect(emailToDomain("alice@strange@acme.com")).toBeNull();
  });

  it("handles real-world subdomain shapes", () => {
    expect(emailToDomain("alerts@notify.acme.co.uk")).toBe("notify.acme.co.uk");
  });
});

describe("isFreeMailDomain", () => {
  it("flags the major consumer mail providers", () => {
    // Spot-check across the families in the list — if any of these
    // ever stop being treated as free-mail, the popup will start
    // surfacing them as "Unclaimed" rows again.
    for (const d of [
      "gmail.com",
      "googlemail.com",
      "yahoo.com",
      "outlook.com",
      "hotmail.com",
      "icloud.com",
      "proton.me",
      "protonmail.com",
      "aol.com",
    ]) {
      expect(isFreeMailDomain(d)).toBe(true);
    }
  });

  it("does not flag business / branded domains", () => {
    for (const d of [
      "acme.com",
      "stripe.com",
      "witnessed.cc",
      "notify.acme.co.uk",
      "mail.acme.com", // looks freemail-y but isn't a known provider
    ]) {
      expect(isFreeMailDomain(d)).toBe(false);
    }
  });

  it("normalises whitespace and case before lookup", () => {
    expect(isFreeMailDomain(" Gmail.COM ")).toBe(true);
    expect(isFreeMailDomain("OUTLOOK.com")).toBe(true);
  });

  it("returns false for null / undefined / empty input", () => {
    expect(isFreeMailDomain(null)).toBe(false);
    expect(isFreeMailDomain(undefined)).toBe(false);
    expect(isFreeMailDomain("")).toBe(false);
    expect(isFreeMailDomain("   ")).toBe(false);
  });

  it("keeps the canonical providers list non-empty and lowercase", () => {
    // Pin: every entry must be lowercase and dot-bearing. A future
    // PR that accidentally adds "Gmail.com" or "localhost" would
    // silently break the case-insensitive lookup or the domain shape.
    expect(FREE_MAIL_DOMAINS.size).toBeGreaterThan(10);
    for (const d of FREE_MAIL_DOMAINS) {
      expect(d).toBe(d.toLowerCase());
      expect(d.includes(".")).toBe(true);
    }
  });
});
