import { fail, ok } from "@/lib/http";
import { resetDatabase } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await resetDatabase();
    return ok({ reset: true });
  } catch (err) {
    return fail(err);
  }
}
