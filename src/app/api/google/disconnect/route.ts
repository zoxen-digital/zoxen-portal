import { ADMIN, apiUser } from "@/lib/session";
import { disconnectGoogle } from "@/lib/google";
import { handle, json } from "@/lib/api";

export const POST = handle(async () => {
  await apiUser(ADMIN);
  await disconnectGoogle();
  return json({ ok: true });
});
