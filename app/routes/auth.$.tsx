import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate, login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.pathname === "/auth/login") {
    return login(request);
  }

  await authenticate.admin(request);

  // Session valid - redirect to /app with shop/host params preserved
  const params = new URLSearchParams();
  const shop = url.searchParams.get("shop");
  const host = url.searchParams.get("host");
  if (shop) params.set("shop", shop);
  if (host) params.set("host", host);
  throw redirect(`/app?${params.toString()}`);
};
