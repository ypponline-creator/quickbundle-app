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
  Icon,
  Divider,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { GiftCardFilledIcon, CartIcon, ChartLineIcon, PackageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [totalBundles, activeBundles, stats] = await Promise.all([
    prisma.bundle.count({ where: { shop } }),
    prisma.bundle.count({ where: { shop, status: "ACTIVE" } }),
    prisma.bundleStat.aggregate({
      where: { shop },
      _sum: { revenue: true },
      _count: { id: true },
    }),
  ]);

  return json({
    shop,
    totalBundles,
    activeBundles,
    totalRevenue: stats._sum.revenue || 0,
    totalOrders: stats._count.id || 0,
  });
};

const BUNDLE_TYPES = [
  {
    type: "FIXED",
    title: "Fixed Bundle",
    description: "Gabungkan produk spesifik dengan diskon tetap",
    color: "#008060",
    emoji: "📦",
  },
  {
    type: "MIX_MATCH",
    title: "Mix & Match",
    description: "Pelanggan pilih N produk dari koleksi dengan diskon",
    color: "#2C6ECB",
    emoji: "🎨",
  },
  {
    type: "BOGO",
    title: "BOGO",
    description: "Buy One Get One - beli 1 gratis 1",
    color: "#D72C0D",
    emoji: "🎁",
  },
  {
    type: "FREE_GIFT",
    title: "Free Gift",
    description: "Hadiah gratis saat membeli produk tertentu",
    color: "#E67C00",
    emoji: "🎀",
  },
  {
    type: "VOLUME",
    title: "Volume Discount",
    description: "Makin banyak beli makin besar diskon",
    color: "#8456D0",
    emoji: "📊",
  },
  {
    type: "CROSS_SELL",
    title: "Cross-sell / Upsell",
    description: "Rekomendasikan produk pelengkap saat checkout",
    color: "#1A9BC2",
    emoji: "⬆️",
  },
];

export default function Dashboard() {
  const { totalBundles, activeBundles, totalRevenue, totalOrders } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

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

        {/* Stats Cards */}
        <Grid>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Total Bundle</Text>
                <Text variant="heading2xl" as="p">{totalBundles}</Text>
                <Badge tone="info">{activeBundles} aktif</Badge>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }}>
            <Card>
              <BlockStack gap="200">
                <Text variant="bodySm" tone="subdued" as="p">Total Order Bundle</Text>
                <Text variant="heading2xl" as="p">{totalOrders}</Text>
                <Badge tone="success">bulan ini</Badge>
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
                <Text variant="bodySm" tone="subdued" as="p">AOV Boost</Text>
                <Text variant="heading2xl" as="p">+0%</Text>
                <Badge>mulai pasang bundle</Badge>
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
              {BUNDLE_TYPES.map((bt) => (
                <Grid.Cell key={bt.type} columnSpan={{ xs: 6, sm: 3, md: 3, lg: 2, xl: 2 }}>
                  <Box
                    padding="400"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor="border"
                    as="div"
                  >
                    <BlockStack gap="200">
                      <Text variant="heading2xl" as="p">{bt.emoji}</Text>
                      <Text variant="headingSm" as="h3">{bt.title}</Text>
                      <Text variant="bodySm" tone="subdued" as="p">{bt.description}</Text>
                      <Button
                        size="slim"
                        onClick={() => navigate(`/app/bundles/new?type=${bt.type}`)}
                      >
                        Buat
                      </Button>
                    </BlockStack>
                  </Box>
                </Grid.Cell>
              ))}
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
                <Text variant="headingSm" as="h3">Plans & Billing</Text>
                <Text variant="bodySm" tone="subdued" as="p">
                  Upgrade untuk unlock semua fitur bundle
                </Text>
                <Button onClick={() => navigate("/app/billing")}>Lihat Plans</Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
