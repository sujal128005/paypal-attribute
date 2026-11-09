import { appUrl, ok } from "@/lib/http";
import { postmanCollection } from "@/lib/openapi";
import { DEMO_API_KEY } from "@/lib/seed";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return ok(postmanCollection(appUrl(req), DEMO_API_KEY), {
    headers: { "Content-Disposition": 'attachment; filename="paypal-attribute.postman_collection.json"' },
  });
}
