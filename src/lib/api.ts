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

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error(e);
      const message = e instanceof Error ? e.message : "Something went wrong";
      return error(message, 500);
    }
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
