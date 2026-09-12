import { describe, it, expect } from "vitest";
import { decodeJwtClaims } from "./jwt";

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "none" })}.${b64(payload)}.sig`;
}

describe("decodeJwtClaims", () => {
  it("reads claims from the payload segment", () => {
    const claims = decodeJwtClaims(jwt({ user_id: "u-1", roles: ["USER"] }));
    expect(claims.user_id).toBe("u-1");
    expect(claims.roles).toEqual(["USER"]);
  });

  it("returns an empty object for a non-JWT string", () => {
    expect(decodeJwtClaims("not-a-jwt")).toEqual({});
    expect(decodeJwtClaims("")).toEqual({});
  });
});
