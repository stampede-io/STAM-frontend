import { describe, it, expect } from "vitest";
import { generateCodeVerifier, generateCodeChallenge } from "./pkce";

describe("PKCE", () => {
  it("generates a code verifier of valid length", () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it("generates URL-safe characters only", () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique verifiers", () => {
    const a = generateCodeVerifier();
    const b = generateCodeVerifier();
    expect(a).not.toBe(b);
  });

  it("generates a valid S256 code challenge", async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge.length).toBeGreaterThan(0);
  });

  it("produces consistent challenge for same verifier", async () => {
    const verifier = "test-verifier-value";
    const a = await generateCodeChallenge(verifier);
    const b = await generateCodeChallenge(verifier);
    expect(a).toBe(b);
  });

  it("produces different challenges for different verifiers", async () => {
    const a = await generateCodeChallenge("verifier-a");
    const b = await generateCodeChallenge("verifier-b");
    expect(a).not.toBe(b);
  });
});
