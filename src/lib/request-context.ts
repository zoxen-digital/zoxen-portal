import { AsyncLocalStorage } from "async_hooks";
import { randomBytes } from "crypto";

/** Who is making the current API request. Lets deletions and the audit log know the actor without passing it around. */
export type RequestContext = {
  id: string;
  actor?: { id: string; name: string; role: string };
  ip?: string;
};

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function newRequestId() {
  return randomBytes(8).toString("hex");
}

export function currentContext() {
  return requestContext.getStore();
}
