import { redirect } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate, login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.pathname === "/auth/login") {
    return login(request);
  }

  await authenticate.admin(request);

  // Pass ALL params (including id_token) so app.tsx can validate session
  throw redirect(`/app?${url.searchParams.toString()}`);
};
