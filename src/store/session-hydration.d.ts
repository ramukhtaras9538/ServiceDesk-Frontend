import type { User } from "@/types";

interface SessionHydrationDependencies {
  readToken: () => Promise<string | null>;
  fetchUser: () => Promise<User>;
  clearToken: () => Promise<void>;
  setApiToken: (token: string | null) => void;
  isUnauthorized: (error: unknown) => boolean;
  describeError: (error: unknown) => string;
  setState: (state: {
    user?: User | null;
    ready: boolean;
    sessionError: string | null;
  }) => void;
}

export function hydrateSession(
  dependencies: SessionHydrationDependencies,
): Promise<void>;
