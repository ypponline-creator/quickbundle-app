import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigate, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Select,
  Checkbox,
  Banner,
  Divider,
  Box,
  Badge,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";
import { getPlan } from "../lib/plan-utils";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  let settings = await prisma.shopSettings.findUnique({ where: { shop: session.shop } });
  if (!settings) {
    settings = await prisma.shopSettings.create({ data: { shop: session.shop } });
  }
  return json({ settings, planKey: settings.plan || "FREE" });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const settings = await prisma.shopSettings.findUnique({ where: { shop: session.shop } });
  const planKey = settings?.plan || "FREE";
  const plan = getPlan(planKey);

  const hideBranding = plan.hasBranding ? false : formData.get("hideBranding") === "true";

  await prisma.shopSettings.upsert({
    where: { shop: session.shop },
    update: {
      widgetPosition: formData.get("widgetPosition") as string,
      widgetTitle: formData.get("widgetTitle") as string,
      primaryColor: formData.get("primaryColor") as string,
      showOnMobile: formData.get("showOnMobile") === "true",
      currency: formData.get("currency") as string || "MYR",
    },
    create: {
      shop: session.shop,
      widgetPosition: (formData.get("widgetPosition") as string) || "below_add_to_cart",
      widgetTitle: (formData.get("widgetTitle") as string) || "Complete the Bundle & Save!",
      primaryColor: (formData.get("primaryColor") as string) || "#008060",
      showOnMobile: formData.get("showOnMobile") === "true",
      currency: (formData.get("currency") as string) || "MYR",
    },
  });

  return json({ saved: true });
};

export default function Settings() {
  const { settings, planKey } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const saving = navigation.state === "submitting";
  const plan = getPlan(planKey);

  const [widgetPosition, setWidgetPosition] = useState(settings.widgetPosition);
  const [widgetTitle, setWidgetTitle] = useState(settings.widgetTitle);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [showOnMobile, setShowOnMobile] = useState(settings.showOnMobile);
  const [currency, setCurrency] = useState(settings.currency || "MYR");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const formData = new FormData();
    formData.append("widgetPosition", widgetPosition);
    formData.append("widgetTitle", widgetTitle);
    formData.append("primaryColor", primaryColor);
    formData.append("showOnMobile", String(showOnMobile));
    formData.append("currency", currency);
    submit(formData, { method: "post" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Page title="Pengaturan Widget">
      <TitleBar title="Pengaturan" />
      <BlockStack gap="600">
        {saved && <Banner tone="success">Pengaturan berhasil disimpan!</Banner>}

        {/* Plan info */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="200" blockAlign="center">
              <Text variant="bodySm" as="p">Plan aktif:</Text>
              <Badge tone={planKey === "FREE" ? "attention" : "success"}>{plan.name}</Badge>
              {plan.hasBranding && (
                <Badge tone="warning">Branding "Powered by QuickBundle" aktif</Badge>
              )}
              {!plan.hasBranding && (
                <Badge tone="success">Tanpa branding QuickBundle ✓</Badge>
              )}
            </InlineStack>
            {plan.hasBranding && (
              <Button size="slim" onClick={() => navigate("/app/billing")}>
                Upgrade untuk hapus branding
              </Button>
            )}
          </InlineStack>
        </Card>

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">

              {/* Widget Appearance */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Tampilan Widget Bundle</Text>
                  <Select
                    label="Posisi Widget di Halaman Produk"
                    options={[
                      { label: "Di bawah tombol Add to Cart", value: "below_add_to_cart" },
                      { label: "Di atas tombol Add to Cart", value: "above_add_to_cart" },
                      { label: "Di bawah deskripsi produk", value: "below_description" },
                    ]}
                    value={widgetPosition}
                    onChange={setWidgetPosition}
                  />
                  <TextField
                    label="Judul Widget"
                    value={widgetTitle}
                    onChange={setWidgetTitle}
                    placeholder="Complete the Bundle & Save!"
                    helpText="Teks yang muncul di bagian atas widget bundle"
                    autoComplete="off"
                  />
                  <TextField
                    label="Warna Utama (Hex)"
                    value={primaryColor}
                    onChange={setPrimaryColor}
                    placeholder="#008060"
                    helpText="Warna tombol dan aksen widget (format: #RRGGBB)"
                    autoComplete="off"
                    prefix={
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          backgroundColor: primaryColor,
                          borderRadius: 4,
                          border: "1px solid #ddd",
                        }}
                      />
                    }
                  />
                </BlockStack>
              </Card>

              {/* Display Settings */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Pengaturan Tampilan</Text>
                  <Select
                    label="Mata Uang Toko"
                    options={[
                      { label: "MYR — Ringgit Malaysia", value: "MYR" },
                      { label: "USD — US Dollar", value: "USD" },
                      { label: "SGD — Singapore Dollar", value: "SGD" },
                      { label: "IDR — Rupiah Indonesia", value: "IDR" },
                    ]}
                    value={currency}
                    onChange={setCurrency}
                    helpText="Digunakan untuk tampilan harga di dashboard dan widget bundle"
                  />
                  <Checkbox
                    label="Tampilkan widget di perangkat mobile"
                    checked={showOnMobile}
                    onChange={setShowOnMobile}
                    helpText="Jika dinonaktifkan, widget hanya muncul di desktop"
                  />
                </BlockStack>
              </Card>

              {/* Branding */}
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Branding Widget</Text>
                  {plan.hasBranding ? (
                    <Box
                      padding="300"
                      background="bg-surface-caution"
                      borderRadius="200"
                      borderWidth="025"
                      borderColor="border-caution"
                    >
                      <BlockStack gap="200">
                        <Text variant="bodySm" as="p">
                          Widget Anda saat ini menampilkan logo <strong>"Powered by QuickBundle"</strong>.
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="p">
                          Upgrade ke plan <strong>Standard</strong> atau lebih tinggi untuk menghilangkan branding ini.
                        </Text>
                        <Button onClick={() => navigate("/app/billing")} variant="primary" size="slim">
                          Upgrade Plan — Mulai $24.99/bln
                        </Button>
                      </BlockStack>
                    </Box>
                  ) : (
                    <Banner tone="success">
                      ✓ Branding QuickBundle tidak ditampilkan di toko Anda. Widget terlihat sepenuhnya milik Anda.
                    </Banner>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          {/* Preview */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Preview Widget</Text>
                  <Box
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                    borderWidth="025"
                    borderColor="border"
                  >
                    <BlockStack gap="200">
                      <div
                        style={{
                          backgroundColor: primaryColor,
                          color: "white",
                          padding: "8px 12px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: "bold",
                        }}
                      >
                        {widgetTitle}
                      </div>
                      <Box padding="200">
                        <BlockStack gap="100">
                          <Text variant="bodySm" as="p">📦 Produk A — {currency} 89.90</Text>
                          <Text variant="bodySm" as="p">📦 Produk B — {currency} 69.90</Text>
                        </BlockStack>
                      </Box>
                      <div
                        style={{
                          backgroundColor: primaryColor,
                          color: "white",
                          padding: "10px",
                          borderRadius: 4,
                          textAlign: "center",
                          fontSize: 13,
                          fontWeight: "bold",
                        }}
                      >
                        Tambah Bundle ke Keranjang — Hemat 15%
                      </div>
                      {plan.hasBranding && (
                        <Text variant="bodySm" tone="subdued" alignment="center" as="p">
                          Powered by QuickBundle
                        </Text>
                      )}
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Card>

              <Button variant="primary" onClick={handleSave} loading={saving} fullWidth>
                Simpan Pengaturan
              </Button>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
