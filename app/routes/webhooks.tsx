import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "APP_UNINSTALLED":
      await prisma.session.deleteMany({ where: { shop } });
      break;

    case "ORDERS_CREATE":
      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
      break;

    case "SHOP_REDACT":
      await prisma.session.deleteMany({ where: { shop } });
      await prisma.bundle.deleteMany({ where: { shop } });
      await prisma.shopSettings.deleteMany({ where: { shop } });
      await prisma.bundleStat.deleteMany({ where: { shop } });
      break;

    default:
      console.log(`Unhandled webhook: ${topic}`);
  }

  return new Response(null, { status: 200 });
};
