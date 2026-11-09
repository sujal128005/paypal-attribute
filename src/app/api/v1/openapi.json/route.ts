import { appUrl, ok } from "@/lib/http";
import { openApiSpec } from "@/lib/openapi";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return ok(openApiSpec(appUrl(req)), { headers: { "Access-Control-Allow-Origin": "*" } });
}
