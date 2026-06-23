import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Box,
  Grid,
  Badge,
  Divider,
  Banner,
  ProgressBar,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getPlan, getRevenuePercent, canUseBundleType } from "../lib/plan-utils";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  const planKey = settings?.plan || "FREE";

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalBundles, activeBundles, stats, monthlyRevStat] = await Promise.all([
    prisma.bundle.count({ where: { shop } }),
    prisma.bundle.count({ where: { shop, status: "ACTIVE" } }),
    prisma.bundleStat.aggregate({
      where: { shop },
      _sum: { revenue: true },
      _count: { id: true },
    }),
    prisma.bundleStat.aggregate({
      where: { shop, createdAt: { gte: startOfMonth } },
      _sum: { revenue: true },
    }),
  ]);

  return json({
    shop,
    planKey,
    totalBundles,
    activeBundles,
    totalRevenue: stats._sum.revenue || 0,
    totalOrders: stats._count.id || 0,
    monthlyRevenue: monthlyRevStat._sum.revenue || 0,
  });
};

const BUNDLE_TYPES = [
  { type: "FIXED", title: "Fixed Bundle", description: "Gabungkan produk spesifik dengan diskon tetap", emoji: "📦", freeOk: true },
  { type: "MIX_MATCH", title: "Mix & Match", description: "Pilih N produk dari koleksi dengan diskon", emoji: "🎨", freeOk: false },
  { type: "BOGO", title: "BOGO", description: "Buy One Get One — beli 1 gratis 1", emoji: "🎁", freeOk: true },
  { type: "FREE_GIFT", title: "Free Gift", description: "Hadiah gratis saat membeli produk tertentu", emoji: "🎀", freeOk: false },
  { type: "VOLUME", title: "Volume Discount", description: "Makin banyak beli makin besar diskon", emoji: "📊", freeOk: false },
  { type: "CROSS_SELL", title: "Cross-sell / Upsell", description: "Rekomendasi produk pelengkap saat checkout", emoji: "⬆️", freeOk: false },
];

export default function Dashboard() {
  const { planKey, totalBundles, activeBundles, totalRevenue, totalOrders, monthlyRevenue } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const plan = getPlan(planKey);
  const revenuePercent = getRevenuePercent(planKey, monthlyRevenue);
  const revenueWarning = revenuePercent >= 80;
  const revenueFull = revenuePercent >= 100;

  return (
    <Page>
      <TitleBar title="QuickBundle Dashboard" />

      <BlockStack gap="600">
        {totalBundles === 0 && (
          <Banner
            title="Selamat datang di QuickBundle!"
            action={{ content: "Buat Bundle Pertama", onAction: () => navigate("/app/bundles/new") }}
            tone="info"
          >
            <p>Buat bundle produk dan tingkatkan AOV (Average Order Value) toko Anda hingga 25%.</p>
          </Banner>
        )}

        {revenueFull && (
          <Banner title="Batas revenue bulan ini tercapai!" tone="warning">
            Bundle baru tidak aktif sampai Anda upgrade plan atau bulan berganti.{" "}
            <Button variant="plain" onClick={() => navigate("/app/billing")}>Upgrade sekarang</Button>
          </Banner>
        )}

        {/* Plan Info Bar */}
        <Card>
          <InlineStack align="space-between" blockAlign="center" wrap={false}>
            <InlineStack gap="300" blockAlign="center">
              <Badge tone={planKey === "FREE" ? "attention" : "success"} size="large">
                {`Plan: ${plan.name}`}
              </Badge>
              {plan.hasBranding && (
                <Badge tone="warning">{"Branding aktif"}</Badge>
              )}
              {plan.hasImageSwatch && (
                <Badge tone="info">{"Image Swatch ✓"}</Badge>
              )}
              {plan.hasAdvancedAnalytics && (
                <Badge tone="info">{"Analytics ✓"}</Badge>
              )}
            </InlineStack>
            {planKey !== "ENTERPRISE" && (
              <Button size="slim" onClick={() => navigate("/app/billing")}>
                Upgrade Plan
              </Button>
            )}
          </InlineStack>

          {plan.revenueLimit && (
            <Box paddingBlockStart="300">
              <BlockStack gap="100">
                <InlineStack align="space-between">
                  <Text variant="bodySm" as="p">
                    Revenue bundle bulan ini: <strong>${monthlyRevenue.toFixed(2)}</strong> / ${plan.revenueLimit.toLocaleString()}
                  </Text>
                  <Text variant="bodySm" tone={revenueWarning ? "caution" : "subdued"} as="p">
                    {revenuePercent.toFixed(0)}%
                  </Text>
                </InlineStack>
                <ProgressBar
                  progress={revenuePercent}
                  tone={revenueFull ? "highlight" : revenueWarning ? "highlight" : "primary"}
                  size="small"
                />
              </BlockStack>
            </Box>
          )}
        </Card>

        {/* Stats Cards */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Total Bundle</Text>
                <Text variant="heading2xl" as="p">{totalBundles}</Text>
                <Badge tone="info">{`${activeBundles} aktif`}</Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Total Order Bundle</Text>
                <Text variant="heading2xl" as="p">{totalOrders}</Text>
                <Badge tone="success">sepanjang waktu</Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Revenue dari Bundle</Text>
                <Text variant="heading2xl" as="p">${totalRevenue.toFixed(2)}</Text>
                <Badge tone="success">total</Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Revenue Bulan Ini</Text>
                <Text variant="heading2xl" as="p">${monthlyRevenue.toFixed(2)}</Text>
                <Badge tone={revenueWarning ? "attention" : "new"}>
                  {plan.revenueLimit ? `limit $${plan.revenueLimit.toLocaleString()}` : "Unlimited"}
                </Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* Bundle Types */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">Buat Bundle Baru</Text>
              <Button variant="primary" onClick={() => navigate("/app/bundles/new")}>
                + Buat Bundle
              </Button>
            </InlineStack>
            <Divider />
            <Grid>
              {BUNDLE_TYPES.map((bt) => {
                const canUse = canUseBundleType(planKey, bt.type);
                return (
                  <Grid.Cell key={bt.type} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 2, xl: 2 }}>
                    <Box
                      padding="400"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      background={canUse ? "bg-surface" : "bg-surface-secondary"}
                    >
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="start">
                          <Text variant="heading2xl" as="p">{bt.emoji}</Text>
                          {!canUse && <Badge tone="attention">Upgrade</Badge>}
                        </InlineStack>
                        <Text variant="headingSm" as="h3">{bt.title}</Text>
                        <Text variant="bodySm" tone="subdued" as="p">{bt.description}</Text>
                        {canUse ? (
                          <Button
                            size="slim"
                            onClick={() => navigate(`/app/bundles/new?type=${bt.type}`)}
                            disabled={revenueFull}
                          >
                            Buat
                          </Button>
                        ) : (
                          <Button size="slim" onClick={() => navigate("/app/billing")}>
                            Upgrade untuk unlock
                          </Button>
                        )}
                      </BlockStack>
                    </Box>
                  </Grid.Cell>
                );
              })}
            </Grid>
          </BlockStack>
        </Card>

        {/* Quick Links */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Pengaturan Widget</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Kustomisasi tampilan bundle di toko Anda
                </Text>
                <Button onClick={() => navigate("/app/settings")}>Buka Settings</Button>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Semua Bundle</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Kelola dan pantau bundle yang sudah dibuat
                </Text>
                <Button onClick={() => navigate("/app/bundles")}>Lihat Bundle</Button>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm" as="h3">Analytics</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  {plan.hasAdvancedAnalytics
                    ? "Lihat performa bundle secara detail"
                    : "Analytics lanjutan tersedia di plan Standard+"}
                </Text>
                <Button
                  onClick={() => navigate("/app/analytics")}
                  disabled={!plan.hasAdvancedAnalytics && planKey === "FREE"}
                >
                  Lihat Analytics
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
