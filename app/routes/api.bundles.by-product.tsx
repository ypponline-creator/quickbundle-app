import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const productId = url.searchParams.get("productId");

  if (!productId) return json({ bundles: [] });

  const bundles = await prisma.bundle.findMany({
    where: {
      shop: session.shop,
      products: {
        some: { productId },
      },
    },
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      discountType: true,
      discountValue: true,
    },
  });

  return json({ bundles });
};
