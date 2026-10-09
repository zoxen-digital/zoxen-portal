import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";

export function json(data: unknown, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

export function error(message: string, status = 400, headers?: HeadersInit) {
  return NextResponse.json({ error: message }, { status, headers });
}

export function validId(id: string) {
  return isValidObjectId(id);
}

/** Throw from a route to answer with a specific status and message. */
export class HttpError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

async function run<A extends unknown[]>(fn: (...args: A) => Promise<Response>, args: A) {
  try {
    return await fn(...args);
  } catch (e) {
    if (e instanceof HttpError) return error(e.message, e.status);
    console.error(e);
    const message = e instanceof Error ? e.message : "Something went wrong";
    return error(message, 500);
  }
}

/**
 * Wraps every API route: turns thrown errors into JSON, and records each successful
 * change (create / update / delete) in the audit log with who did it.
 */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    const req = args[0] instanceof Request ? args[0] : null;
    const path = req ? new URL(req.url).pathname : "";
    const { shouldAudit } = await import("./audit");
    if (!req || !shouldAudit(req.method, path)) return run(fn, args);

    const { requestContext, newRequestId } = await import("./request-context");
    const { currentUser } = await import("./session");
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0]!.trim() || undefined;
    const user = await currentUser().catch(() => null);
    const ctx = { id: newRequestId(), ip, actor: user ? { id: user.id, name: user.name, role: user.role } : undefined };
    const body = await req
      .clone()
      .json()
      .catch(() => null);

    const res = await requestContext.run(ctx, () => run(fn, args));
    if (res.status < 400) {
      const response = await res
        .clone()
        .json()
        .catch(() => null);
      const { writeAudit } = await import("./audit");
      await writeAudit({ actor: ctx.actor, method: req.method, path, status: res.status, body, response, ip, batch: ctx.id });
    }
    return res;
  };
}

/** Keep only allowed keys, trimming strings. */
export function pick<T extends Record<string, unknown>>(body: T, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (k in body) {
      const v = body[k];
      out[k] = typeof v === "string" ? v.trim() : v;
    }
  }
  return out;
}
