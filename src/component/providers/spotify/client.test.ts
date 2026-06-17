import { describe, expect, it, vi } from "vitest";
import { ProviderHttpError, type FetchDeps } from "../fetch.js";
import { fetchSpotifyToken } from "./client.js";

function deps(response: Response, spy?: (init: RequestInit) => void): FetchDeps {
  return {
    fetch: (_url, init) => {
      spy?.(init);
      return Promise.resolve(response);
    },
    sleep: () => Promise.resolve(),
    random: () => 0,
  };
}

describe("fetchSpotifyToken", () => {
  it("exchanges credentials and maps the token + lifetime", async () => {
    let seen: RequestInit | undefined;
    const token = await fetchSpotifyToken(
      "id",
      "secret",
      undefined,
      deps(
        new Response(
          JSON.stringify({
            access_token: "tok-123",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
        (init) => {
          seen = init;
        },
      ),
    );
    expect(token).toEqual({ accessToken: "tok-123", expiresInSec: 3600 });
    expect(seen?.method).toBe("POST");
    expect(seen?.body).toBe("grant_type=client_credentials");
    const headers = seen?.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe(`Basic ${btoa("id:secret")}`);
  });

  it("throws on invalid credentials (400)", async () => {
    await expect(
      fetchSpotifyToken(
        "id",
        "bad",
        undefined,
        deps(new Response("invalid_client", { status: 400 })),
      ),
    ).rejects.toThrow(ProviderHttpError);
  });

  it("works against the default deps + global fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              access_token: "g",
              token_type: "Bearer",
              expires_in: 10,
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        ),
      ),
    );
    try {
      expect(await fetchSpotifyToken("id", "secret")).toEqual({
        accessToken: "g",
        expiresInSec: 10,
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
