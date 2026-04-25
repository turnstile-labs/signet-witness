import { describe, it, expect } from "vitest";
import { emailToDomain } from "../src/lib/parse";

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
