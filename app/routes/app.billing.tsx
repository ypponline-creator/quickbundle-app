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
  List,
  Box,
  ProgressBar,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PLANS, getPlan, getRevenuePercent } from "../lib/plan-utils";

const OWNER_SHOPS = (process.env.OWNER_SHOPS || "").split(",").map((s) => s.trim()).filter(Boolean);
const isOwnerShop = (shop: string) => OWNER_SHOPS.includes(shop);

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  if (isOwnerShop(session.shop)) {
    await prisma.shopSettings.upsert({
      where: { shop: session.shop },
      update: { plan: "ENTERPRISE" },
      create: { shop: session.shop, plan: "ENTERPRISE" },
    });
    return json({ currentPlan: "ENTERPRISE", isOwner: true, monthlyRevenue: 0 });
  }

  const settings = await prisma.shopSettings.findUnique({ where: { shop: session.shop } });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const revenueStat = await prisma.bundleStat.aggregate({
    where: { shop: session.shop, createdAt: { gte: startOfMonth } },
    _sum: { revenue: true },
  });

  return json({
    currentPlan: settings?.plan || "FREE",
    isOwner: false,
    monthlyRevenue: revenueStat._sum.revenue || 0,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  if (isOwnerShop(session.shop)) return json({ ok: true });

  const formData = await request.formData();
  const planKey = formData.get("plan") as string;

  if (planKey === "FREE") {
    await prisma.shopSettings.upsert({
      where: { shop: session.shop },
      update: { plan: "FREE" },
      create: { shop: session.shop, plan: "FREE" },
    });
    return json({ ok: true });
  }

  const planConfig = PLANS.find((p) => p.key === planKey);
  if (!planConfig || planConfig.price === 0) return json({ error: "Invalid plan" }, { status: 400 });

  try {
    const { confirmationUrl } = await (billing as any).request({
      plan: planConfig.name,
      amount: planConfig.price,
      currencyCode: "USD",
      interval: "EVERY_30_DAYS",
      trialDays: 7,
      isTest: process.env.NODE_ENV !== "production",
      returnUrl: `${process.env.SHOPIFY_APP_URL}/app/billing`,
    });
    if (confirmationUrl) return redirect(confirmationUrl);
  } catch {
    // already subscribed or error — update plan directly
  }

  await prisma.shopSettings.upsert({
    where: { shop: session.shop },
    update: { plan: planKey },
    create: { shop: session.shop, plan: planKey },
  });

  return json({ ok: true });
};

export default function Billing() {
  const { currentPlan, isOwner, monthlyRevenue } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const activePlan = getPlan(currentPlan);
  const revenuePercent = getRevenuePercent(currentPlan, monthlyRevenue);
  const revenueWarning = revenuePercent >= 80;

  const handleSelect = (planKey: string) => {
    submit({ plan: planKey }, { method: "post" });
  };

  return (
    <Page title="Plans & Billing">
      <TitleBar title="Plans & Billing" />
      <BlockStack gap="600">

        {/* Status Plan Aktif */}
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <Text variant="headingMd" as="h2">Plan Aktif</Text>
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone={isOwner ? "magic" : "success"} size="large">
                    {activePlan.name}
                  </Badge>
                  {isOwner && <Badge tone="magic">Developer — Gratis Selamanya</Badge>}
                  {!isOwner && activePlan.price > 0 && (
                    <Text as="span" tone="subdued" variant="bodySm">
                      7 hari trial gratis • ${activePlan.price}/bulan
                    </Text>
                  )}
                </InlineStack>
              </BlockStack>
              <Text variant="bodySm" tone="subdued" as="p">{activePlan.supportSLA}</Text>
            </InlineStack>

            {activePlan.revenueLimit && !isOwner && (
              <BlockStack gap="100">
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="p">
                    Bundle Revenue Bulan Ini: <strong>${monthlyRevenue.toFixed(2)}</strong> / ${activePlan.revenueLimit.toLocaleString()}
                  </Text>
                  <Text variant="bodySm" tone={revenueWarning ? "caution" : "subdued"} as="p">
                    {revenuePercent.toFixed(0)}%
                  </Text>
                </InlineStack>
                <ProgressBar progress={revenuePercent} tone={revenueWarning ? "highlight" : "primary"} size="small" />
                {revenueWarning && (
                  <Text variant="bodySm" tone="caution" as="p">
                    ⚠️ Revenue hampir mencapai batas. Pertimbangkan upgrade plan.
                  </Text>
                )}
              </BlockStack>
            )}
          </BlockStack>
        </Card>

        {revenuePercent >= 100 && (
          <Banner tone="warning" title="Batas revenue tercapai!">
            Bundle baru tidak akan aktif hingga Anda upgrade plan atau bulan berganti.
          </Banner>
        )}

        {/* Grid Plans */}
        <Layout>
          {PLANS.map((plan) => {
            const isCurrent = plan.key === currentPlan;
            const isUpgrade = plan.price > activePlan.price;
            const isDowngrade = plan.price < activePlan.price && plan.price > 0;

            return (
              <Layout.Section key={plan.key} variant="oneThird">
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="start">
                      <BlockStack gap="050">
                        <Text variant="headingMd" as="h2">{plan.name}</Text>
                        <Text variant="bodySm" tone="subdued" as="p">{plan.description}</Text>
                      </BlockStack>
                      {plan.popular && <Badge tone="info">Populer</Badge>}
                      {plan.enterprise && <Badge tone="magic">Enterprise</Badge>}
                    </InlineStack>

                    <BlockStack gap="050">
                      <InlineStack gap="100" blockAlign="end">
                        <Text variant="heading2xl" as="span">
                          {plan.price === 0 ? "Gratis" : `$${plan.price}`}
                        </Text>
                        {plan.price > 0 && (
                          <Text variant="bodySm" tone="subdued" as="span">/bln</Text>
                        )}
                      </InlineStack>
                      <Badge tone={plan.revenueLimit ? "attention" : "success"}>
                        {plan.revenueLabelMonthly}
                      </Badge>
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="100">
                      <Text variant="bodySm" fontWeight="semibold" as="p">Termasuk:</Text>
                      <List type="bullet" gap="extraTight">
                        {plan.features.map((f) => (
                          <List.Item key={f}>{f}</List.Item>
                        ))}
                      </List>
                      {plan.notIncluded.length > 0 && (
                        <>
                          <Box paddingBlockStart="200">
                            <Text variant="bodySm" tone="subdued" as="p">Tidak termasuk:</Text>
                          </Box>
                          <List type="bullet" gap="extraTight">
                            {plan.notIncluded.map((f) => (
                              <List.Item key={f}>
                                <Text as="span" tone="subdued">{f}</Text>
                              </List.Item>
                            ))}
                          </List>
                        </>
                      )}
                    </BlockStack>

                    <Box paddingBlockStart="200">
                      {isCurrent ? (
                        <Button disabled fullWidth>Plan Aktif ✓</Button>
                      ) : isUpgrade ? (
                        <Button variant="primary" onClick={() => handleSelect(plan.key)} fullWidth>
                          Upgrade ke {plan.name}
                        </Button>
                      ) : plan.key === "FREE" ? (
                        <Button onClick={() => handleSelect(plan.key)} fullWidth tone="critical">
                          Downgrade ke Free
                        </Button>
                      ) : (
                        <Button onClick={() => handleSelect(plan.key)} fullWidth>
                          Pindah ke {plan.name}
                        </Button>
                      )}
                    </Box>
                  </BlockStack>
                </Card>
              </Layout.Section>
            );
          })}
        </Layout>

        <Card>
          <Text variant="bodySm" tone="subdued" as="p">
            Semua harga dalam USD. Tagihan diproses setiap 30 hari. Trial 7 hari gratis untuk semua plan berbayar.
            Batalkan kapan saja sebelum trial berakhir tanpa biaya. Revenue limit dihitung dari total penjualan bundle per bulan kalender.
          </Text>
        </Card>
      </BlockStack>
    </Page>
  );
}
