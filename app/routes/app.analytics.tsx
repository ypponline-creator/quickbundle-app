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
  Banner,
  DataTable,
  Divider,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getPlan } from "../lib/plan-utils";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  const planKey = settings?.plan || "FREE";
  const plan = getPlan(planKey);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfLastMonth = new Date(startOfMonth);
  startOfLastMonth.setMonth(startOfLastMonth.getMonth() - 1);

  const [
    totalStats,
    monthlyStats,
    lastMonthStats,
    bundlePerformance,
  ] = await Promise.all([
    prisma.bundleStat.aggregate({
      where: { shop },
      _sum: { revenue: true },
      _count: { id: true },
    }),
    prisma.bundleStat.aggregate({
      where: { shop, createdAt: { gte: startOfMonth } },
      _sum: { revenue: true },
      _count: { id: true },
    }),
    prisma.bundleStat.aggregate({
      where: { shop, createdAt: { gte: startOfLastMonth, lt: startOfMonth } },
      _sum: { revenue: true },
      _count: { id: true },
    }),
    // Revenue per bundle (hanya plan Standard+)
    plan.hasAdvancedAnalytics
      ? prisma.bundleStat.groupBy({
          by: ["bundleId"],
          where: { shop },
          _sum: { revenue: true },
          _count: { id: true },
          orderBy: { _sum: { revenue: "desc" } },
          take: 10,
        })
      : Promise.resolve([]),
  ]);

  // Ambil title bundle untuk advanced analytics
  let bundleDetails: { id: string; title: string; type: string }[] = [];
  if (plan.hasAdvancedAnalytics && bundlePerformance.length > 0) {
    bundleDetails = await prisma.bundle.findMany({
      where: { id: { in: bundlePerformance.map((b) => b.bundleId) } },
      select: { id: true, title: true, type: true },
    });
  }

  const monthlyRevenue = monthlyStats._sum.revenue || 0;
  const lastMonthRevenue = lastMonthStats._sum.revenue || 0;
  const revenueGrowth = lastMonthRevenue > 0
    ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
    : 0;

  return json({
    planKey,
    hasAdvancedAnalytics: plan.hasAdvancedAnalytics,
    currency: settings?.currency || "MYR",
    totalRevenue: totalStats._sum.revenue || 0,
    totalOrders: totalStats._count.id || 0,
    monthlyRevenue,
    monthlyOrders: monthlyStats._count.id || 0,
    lastMonthRevenue,
    lastMonthOrders: lastMonthStats._count.id || 0,
    revenueGrowth,
    bundlePerformance: bundlePerformance.map((b) => {
      const detail = bundleDetails.find((d) => d.id === b.bundleId);
      return {
        bundleId: b.bundleId,
        title: detail?.title || "—",
        type: detail?.type || "—",
        revenue: b._sum.revenue || 0,
        orders: b._count.id || 0,
      };
    }),
  });
};

const TYPE_LABELS: Record<string, string> = {
  FIXED: "Fixed Bundle",
  MIX_MATCH: "Mix & Match",
  BOGO: "BOGO",
  FREE_GIFT: "Free Gift",
  VOLUME: "Volume Discount",
  CROSS_SELL: "Cross-sell",
};

export default function Analytics() {
  const {
    planKey,
    hasAdvancedAnalytics,
    currency,
    totalRevenue,
    totalOrders,
    monthlyRevenue,
    monthlyOrders,
    lastMonthRevenue,
    lastMonthOrders,
    revenueGrowth,
    bundlePerformance,
  } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const avgOrderValue = monthlyOrders > 0 ? monthlyRevenue / monthlyOrders : 0;

  return (
    <Page title="Analytics Bundle">
      <TitleBar title="Analytics" />
      <BlockStack gap="600">

        {!hasAdvancedAnalytics && planKey !== "FREE" && (
          <Banner
            tone="info"
            title="Analytics Lanjutan"
            action={{ content: "Upgrade ke Growth", onAction: () => navigate("/app/billing") }}
          >
            Upgrade ke plan Growth atau Enterprise untuk melihat performa per bundle, konversi, dan laporan CSV.
          </Banner>
        )}

        {planKey === "FREE" && (
          <Banner
            tone="warning"
            title="Analytics terbatas di plan Free"
            action={{ content: "Lihat Plans", onAction: () => navigate("/app/billing") }}
          >
            Upgrade ke plan Basic+ untuk melihat analytics bulanan dan performa bundle.
          </Banner>
        )}

        {/* Stats Overview */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Total Revenue Bundle</Text>
                <Text variant="heading2xl" as="p">{currency} {totalRevenue.toFixed(2)}</Text>
                <Badge tone="success">Sepanjang waktu</Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Revenue Bulan Ini</Text>
                <Text variant="heading2xl" as="p">{currency} {monthlyRevenue.toFixed(2)}</Text>
                <Badge tone={revenueGrowth >= 0 ? "success" : "critical"}>
                  {`${revenueGrowth >= 0 ? "+" : ""}${revenueGrowth.toFixed(1)}% vs bulan lalu`}
                </Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Order Bundle Bulan Ini</Text>
                <Text variant="heading2xl" as="p">{monthlyOrders}</Text>
                <Badge tone={monthlyOrders >= lastMonthOrders ? "success" : "attention"}>
                  {`vs ${lastMonthOrders} bulan lalu`}
                </Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Avg. Order Value Bundle</Text>
                <Text variant="heading2xl" as="p">
                  {avgOrderValue > 0 ? `${currency} ${avgOrderValue.toFixed(2)}` : "—"}
                </Text>
                <Badge>Bulan ini</Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* Bulan Lalu Comparison */}
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Perbandingan Bulan Ini vs Bulan Lalu</Text>
            <Divider />
            <Grid>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued" as="p">Bulan Ini</Text>
                  <Text variant="headingLg" as="p">{currency} {monthlyRevenue.toFixed(2)}</Text>
                  <Text variant="bodySm" as="p">{monthlyOrders} order</Text>
                </BlockStack>
              </Grid.Cell>
              <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                <BlockStack gap="200">
                  <Text variant="bodySm" tone="subdued" as="p">Bulan Lalu</Text>
                  <Text variant="headingLg" as="p">{currency} {lastMonthRevenue.toFixed(2)}</Text>
                  <Text variant="bodySm" as="p">{lastMonthOrders} order</Text>
                </BlockStack>
              </Grid.Cell>
            </Grid>
          </BlockStack>
        </Card>

        {/* Performance per Bundle — Advanced Analytics */}
        {hasAdvancedAnalytics ? (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="050">
                  <Text variant="headingMd" as="h2">Performa per Bundle (Top 10)</Text>
                  <Text variant="bodySm" tone="subdued" as="p">
                    Diurutkan berdasarkan revenue tertinggi
                  </Text>
                </BlockStack>
                <Badge tone="magic">Growth+ Feature</Badge>
              </InlineStack>

              {bundlePerformance.length === 0 ? (
                <Box padding="600" background="bg-surface-secondary" borderRadius="200">
                  <Text alignment="center" tone="subdued" as="p">
                    Belum ada data penjualan bundle. Data akan muncul setelah ada order masuk.
                  </Text>
                </Box>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric"]}
                  headings={["Nama Bundle", "Tipe", "Revenue", "Orders"]}
                  rows={bundlePerformance.map((b) => [
                    b.title,
                    TYPE_LABELS[b.type] || b.type,
                    `${currency} ${b.revenue.toFixed(2)}`,
                    String(b.orders),
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        ) : (
          <Card>
            <Box
              padding="600"
              background="bg-surface-secondary"
              borderRadius="200"
            >
              <BlockStack gap="300" inlineAlign="center">
                <Text variant="headingMd" alignment="center" as="h2">
                  🔒 Performa per Bundle
                </Text>
                <Text variant="bodySm" tone="subdued" alignment="center" as="p">
                  Lihat revenue, order, dan konversi untuk setiap bundle secara individual.
                  Tersedia di plan Growth dan Enterprise.
                </Text>
                <Button variant="primary" onClick={() => navigate("/app/billing")}>
                  Upgrade ke Growth — $49.99/bln
                </Button>
              </BlockStack>
            </Box>
          </Card>
        )}

        {/* Total keseluruhan */}
        <Card>
          <BlockStack gap="200">
            <Text variant="headingMd" as="h2">Ringkasan Total</Text>
            <Divider />
            <InlineStack align="space-between">
              <Text variant="bodySm" as="p">Total Revenue Bundle (all time)</Text>
              <Text variant="bodyMd" fontWeight="semibold" as="p">{currency} {totalRevenue.toFixed(2)}</Text>
            </InlineStack>
            <InlineStack align="space-between">
              <Text variant="bodySm" as="p">Total Order Bundle (all time)</Text>
              <Text variant="bodyMd" fontWeight="semibold" as="p">{totalOrders} order</Text>
            </InlineStack>
            <InlineStack align="space-between">
              <Text variant="bodySm" as="p">Rata-rata Revenue per Order</Text>
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                {totalOrders > 0 ? `${currency} ${(totalRevenue / totalOrders).toFixed(2)}` : "—"}
              </Text>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
