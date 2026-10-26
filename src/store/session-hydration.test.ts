import { hydrateSession } from "./session-hydration";
import type { User } from "@/types";

const user = {
  id: 1,
  empId: "E001",
  name: "Test User",
  email: null,
  role: "user",
  departmentId: null,
  department: null,
} satisfies User;

function setup(overrides: Partial<Parameters<typeof hydrateSession>[0]> = {}) {
  const calls = { cleared: 0, tokens: [] as Array<string | null>, states: [] as object[] };
  const dependencies: Parameters<typeof hydrateSession>[0] = {
    readToken: async () => "saved-token",
    fetchUser: async () => user,
    clearToken: async () => {
      calls.cleared += 1;
    },
    setApiToken: (token) => calls.tokens.push(token),
    isUnauthorized: (error) =>
      typeof error === "object" &&
      error !== null &&
      "status" in error &&
      error.status === 401,
    describeError: (error) =>
      error instanceof Error ? error.message : String(error),
    setState: (state) => calls.states.push(state),
    ...overrides,
  };
  return { calls, dependencies };
}

describe("hydrateSession", () => {
  it("retains a saved token when verification fails transiently", async () => {
    const { calls, dependencies } = setup({
      fetchUser: async () => {
        throw new Error("Network unavailable");
      },
    });

    await hydrateSession(dependencies);

    expect(calls.cleared).toBe(0);
    expect(calls.tokens).toEqual(["saved-token", null]);
    expect(calls.states[0]).toMatchObject({
      ready: true,
      sessionError: expect.stringContaining("saved session has not been deleted"),
    });
  });

  it("clears an unauthorized token", async () => {
    const { calls, dependencies } = setup({
      fetchUser: async () => {
        throw { status: 401 };
      },
    });

    await hydrateSession(dependencies);

    expect(calls.cleared).toBe(1);
    expect(calls.states[0]).toEqual({
      user: null,
      ready: true,
      sessionError: null,
    });
  });

  it("does not delete a token when secure storage cannot be read", async () => {
    const { calls, dependencies } = setup({
      readToken: async () => {
        throw new Error("Secure storage unavailable");
      },
    });

    await hydrateSession(dependencies);

    expect(calls.cleared).toBe(0);
    expect(calls.tokens).toEqual([]);
    expect(calls.states[0]).toMatchObject({
      ready: true,
      sessionError: expect.stringContaining("Secure storage unavailable"),
    });
  });

  it("stores the verified user without clearing the token", async () => {
    const { calls, dependencies } = setup();

    await hydrateSession(dependencies);

    expect(calls.cleared).toBe(0);
    expect(calls.states[0]).toEqual({
      user,
      ready: true,
      sessionError: null,
    });
  });
});
