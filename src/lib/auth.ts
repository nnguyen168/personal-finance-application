import "server-only";

import { cookies } from "next/headers";
import { isValidSession, SESSION_COOKIE } from "./session";

/** Call at the top of every Server Action — actions are reachable by direct POST. */
export async function requireAuth(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) throw new Error("Not signed in");
}
