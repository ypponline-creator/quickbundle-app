import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Divider,
  Icon,
  List,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PLANS = [
  {
    key: "FREE",
    name: "Free",
    price: 0,
    limit: "Dev Store",
    description: "Untuk development store",
    features: [
      "Unlimited bundle (dev store)",
      "Mix & Match",
      "BOGO",
      "Volume Discount",
      "Free Gift",
      "Product Add-ons",
    ],
    color: "#637381",
  },
  {
    key: "STARTER",
    name: "Starter",
    price: 9.99,
    limit: "$500/bln bundle sales",
    description: "Untuk toko baru",
    features: [
      "Semua tipe bundle",
      "Sampai $500/bln bundle sales",
      "Widget kustom",
      "Email support",
    ],
    color: "#008060",
    popular: false,
  },
  {
    key: "GROWTH",
    name: "Growth",
    price: 29.99,
    limit: "$3,000/bln bundle sales",
    description: "Untuk toko berkembang",
    features: [
      "Semua tipe bundle",
      "Sampai $3,000/bln bundle sales",
      "Priority support",
      "Analytics bundle",
      "A/B testing widget",
    ],
    color: "#2C6ECB",
    popular: true,
  },
  {
    key: "PRO",
    name: "Pro",
    price: 99.99,
    limit: "Unlimited bundle sales",
    description: "Untuk toko skala besar",
    features: [
      "Semua fitur Growth",
      "Unlimited bundle sales",
      "Custom branding",
      "API access",
      "Dedicated support",
    ],
    color: "#8456D0",
    popular: false,
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.shopSettings.findUnique({
    where: { shop: session.shop },
  });
  return json({ currentPlan: settings?.plan || "FREE" });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const plan = formData.get("plan") as string;

  if (plan === "FREE") return json({ ok: true });

  const planConfig = PLANS.find((p) => p.key === plan);
  if (!planConfig) return json({ error: "Invalid plan" }, { status: 400 });

  try {
    await billing.require({
      plans: [
        {
          amount: planConfig.price,
          currencyCode: "USD",
          interval: "EVERY_30_DAYS",
          trialDays: 7,
        },
      ],
      onFailure: async () => {
        throw new Response("Billing required", { status: 402 });
      },
    });
  } catch {
    const { confirmationUrl } = await billing.request({
      plan: planConfig.name,
      amount: planConfig.price,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS",
      trialDays: 7,
      isTest: process.env.NODE_ENV !== "production",
      returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing?plan=${plan}`,
    });
    return redirect(confirmationUrl);
  }

  return json({ ok: true });
};

export default function Billing() {
  const { currentPlan } = useLoaderData<typeof loader>();
  const submit = useSubmit();

  const handleUpgrade = (planKey: string) => {
    submit({ plan: planKey }, { method: "post" });
  };

  return (
    <Page title="Plans & Billing">
      <TitleBar title="Plans & Billing" />
      <BlockStack gap="600">
        <Card>
          <BlockStack gap="200">
            <Text variant="headingMd" as="h2">Plan Aktif Anda</Text>
            <InlineStack gap="300">
              <Badge tone="success" size="large">
                {PLANS.find((p) => p.key === currentPlan)?.name || "Free"}
              </Badge>
              <Text as="span" tone="subdued" variant="bodyMd">
                7 hari trial untuk semua plan berbayar
              </Text>
            </InlineStack>
          </BlockStack>
        </Card>

        <Layout>
          {PLANS.map((plan) => (
            <Layout.Section key={plan.key} variant="oneQuarter">
              <Card>
                <BlockStack gap="400">
                  {plan.popular && (
                    <Badge tone="info">Paling Populer</Badge>
                  )}
                  <BlockStack gap="100">
                    <Text variant="headingLg" as="h2">{plan.name}</Text>
                    <InlineStack gap="100" align="start">
                      <Text variant="heading2xl" as="span">
                        ${plan.price}
                      </Text>
                      {plan.price > 0 && (
                        <Text variant="bodySm" tone="subdued" as="span">
                          /bulan
                        </Text>
                      )}
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued" as="p">
                      {plan.limit}
                    </Text>
                  </BlockStack>

                  <Divider />

                  <List type="bullet" gap="extraTight">
                    {plan.features.map((f) => (
                      <List.Item key={f}>{f}</List.Item>
                    ))}
                  </List>

                  <Box paddingBlockStart="200">
                    {currentPlan === plan.key ? (
                      <Button disabled fullWidth>
                        Plan Aktif
                      </Button>
                    ) : plan.price === 0 ? (
                      <Button
                        onClick={() => handleUpgrade(plan.key)}
                        fullWidth
                      >
                        Downgrade ke Free
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        onClick={() => handleUpgrade(plan.key)}
                        fullWidth
                      >
                        {plan.price > (PLANS.find(p => p.key === currentPlan)?.price || 0)
                          ? "Upgrade"
                          : "Downgrade"} ke {plan.name}
                      </Button>
                    )}
                  </Box>
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}
        </Layout>

        <Card>
          <Text variant="bodySm" tone="subdued" as="p">
            Semua harga dalam USD. Tagihan diproses setiap 30 hari. Trial 7 hari gratis untuk semua plan berbayar.
            Batalkan kapan saja sebelum trial berakhir tanpa dikenakan biaya.
          </Text>
        </Card>
      </BlockStack>
    </Page>
  );
}
