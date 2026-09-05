import { describe, it, expect, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { api } from "./client";

describe("api.request (via api methods)", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset window.location after any test that may have triggered redirect
    window.location.href = "http://localhost/";
  });

  describe("auth header", () => {
    it("includes Authorization header when token is set", async () => {
      localStorage.setItem("ls_token", "test-jwt-token");

      let capturedAuth: string | null = null;
      server.use(
        http.get("/api/auth/me", ({ request }) => {
          capturedAuth = request.headers.get("Authorization");
          return HttpResponse.json({
            id: "u1",
            username: "testuser",
            display_name: "Test",
            is_admin: false,
            settings: {},
          });
        }),
      );

      await api.me();
      expect(capturedAuth).toBe("Bearer test-jwt-token");
    });

    it("omits Authorization header when no token", async () => {
      let capturedAuth: string | null = "initially-something";
      server.use(
        http.get("/api/auth/me", ({ request }) => {
          capturedAuth = request.headers.get("Authorization");
          return HttpResponse.json({
            id: "u1",
            username: "testuser",
            display_name: "Test",
            is_admin: false,
            settings: {},
          });
        }),
      );

      await api.me();
      expect(capturedAuth).toBeNull();
    });
  });

  describe("error handling", () => {
    it("throws with detail message on 4xx", async () => {
      server.use(
        http.get("/api/auth/me", () => {
          return HttpResponse.json({ detail: "Not found" }, { status: 404 });
        }),
      );

      await expect(api.me()).rejects.toThrow("Not found");
    });

    it("throws generic message when response has no detail", async () => {
      server.use(
        http.get("/api/auth/me", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );

      await expect(api.me()).rejects.toThrow();
    });

    it("clears token and redirects on 401", async () => {
      localStorage.setItem("ls_token", "expired-token");
      server.use(
        http.get("/api/auth/me", () => {
          return new HttpResponse(null, { status: 401 });
        }),
      );

      await expect(api.me()).rejects.toThrow("Unauthorized");
      expect(localStorage.getItem("ls_token")).toBeNull();
    });
  });

  describe("successful requests", () => {
    it("parses JSON response", async () => {
      const result = await api.me();
      expect(result.id).toBe("user-test-1");
      expect(result.username).toBe("testuser");
    });

    it("returns undefined on 204 No Content", async () => {
      server.use(
        http.delete("/api/stories/:id", () => {
          return new HttpResponse(null, { status: 204 });
        }),
      );

      const result = await api.deleteStory("story-1");
      expect(result).toBeUndefined();
    });
  });

  describe("streaming endpoints", () => {
    it("returns raw Response object (not parsed JSON)", async () => {
      const response = await api.summarizeStory("story-1");
      expect(response).toBeInstanceOf(Response);
      expect(response.body).not.toBeNull();
    });

    it("streaming response has correct content type", async () => {
      const response = await api.summarizeStory("story-1");
      // Text streams from the server
      expect(response.headers.get("Content-Type")).toContain("text/plain");
    });
  });
});

describe("api.login", () => {
  it("returns access token", async () => {
    const result = await api.login("admin", "password");
    expect(result.access_token).toBe("mock-token-12345");
  });
});
