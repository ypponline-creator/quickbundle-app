import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useNavigate,
  useSearchParams,
  useActionData,
  useSubmit,
} from "@remix-run/react";
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
  ChoiceList,
  Divider,
  Badge,
  Thumbnail,
  ResourceList,
  ResourceItem,
  Box,
  Banner,
  Checkbox,
  Tooltip,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";
import { getPlan, canUseBundleType } from "../lib/plan-utils";

const BUNDLE_TYPES = [
  { label: "📦 Fixed Bundle — gabung produk spesifik dengan diskon", value: "FIXED" },
  { label: "🎨 Mix & Match — pilih N dari koleksi dengan diskon", value: "MIX_MATCH" },
  { label: "🎁 BOGO — beli 1 gratis 1", value: "BOGO" },
  { label: "🎀 Free Gift — hadiah gratis saat beli produk", value: "FREE_GIFT" },
  { label: "📊 Volume Discount — makin banyak makin hemat", value: "VOLUME" },
  { label: "⬆️ Cross-sell — rekomendasi produk pelengkap", value: "CROSS_SELL" },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.shopSettings.findUnique({ where: { shop: session.shop } });
  return json({
    currency: settings?.currency || "MYR",
    planKey: settings?.plan || "FREE",
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const title = formData.get("title") as string;
  const type = formData.get("type") as string;
  const discountType = formData.get("discountType") as string;
  const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
  const productsJson = formData.get("products") as string;
  const volumeTiersJson = formData.get("volumeTiers") as string;
  const minSelectQty = parseInt(formData.get("minSelectQty") as string) || 1;
  const maxSelectQty = parseInt(formData.get("maxSelectQty") as string) || 1;

  if (!title || !type) {
    return json({ error: "Nama bundle dan tipe harus diisi" }, { status: 400 });
  }

  const settings = await prisma.shopSettings.findUnique({ where: { shop: session.shop } });
  const planKey = settings?.plan || "FREE";

  if (!canUseBundleType(planKey, type)) {
    return json({ error: `Tipe bundle ini membutuhkan upgrade plan. Plan Anda saat ini: ${planKey}.` }, { status: 403 });
  }

  const products = productsJson ? JSON.parse(productsJson) : [];
  const volumeTiers = volumeTiersJson ? JSON.parse(volumeTiersJson) : [];

  const bundle = await prisma.bundle.create({
    data: {
      shop: session.shop,
      title,
      type,
      discountType,
      discountValue,
      status: "ACTIVE",
      minQuantity: type === "MIX_MATCH" ? minSelectQty : undefined,
      maxQuantity: type === "MIX_MATCH" ? maxSelectQty : undefined,
      products: {
        create: products.map((p: any) => ({
          productId: p.id,
          productTitle: p.title,
          productImage: p.image,
          variantId: p.variantId,
          variantTitle: p.variantTitle,
          price: p.price || 0,
          comparePrice: p.comparePrice,
          quantity: p.quantity || 1,
          isRequired: p.isRequired !== false,
          role: p.role || "MAIN",
        })),
      },
      volumeTiers:
        type === "VOLUME"
          ? {
              create: volumeTiers.map((t: any) => ({
                minQuantity: t.minQuantity,
                discountType: t.discountType || "PERCENTAGE",
                discountValue: t.discountValue,
              })),
            }
          : undefined,
    },
  });

  return redirect(`/app/bundles/${bundle.id}?created=true`);
};

interface Product {
  id: string;
  title: string;
  image?: string;
  variantId?: string;
  variantTitle?: string;
  price?: number;
  quantity: number;
  role: string;
}

interface VolumeTier {
  minQuantity: number;
  discountType: string;
  discountValue: number;
}

export default function NewBundle() {
  const { currency, planKey } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const plan = getPlan(planKey);

  const defaultType = searchParams.get("type") || "FIXED";
  const [title, setTitle] = useState("");
  const [type, setType] = useState(defaultType);
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("10");
  const [products, setProducts] = useState<Product[]>([]);
  const [giftProducts, setGiftProducts] = useState<Product[]>([]);
  const [minSelectQty, setMinSelectQty] = useState("2");
  const [maxSelectQty, setMaxSelectQty] = useState("3");
  const [showImageSwatch, setShowImageSwatch] = useState(false);
  const [volumeTiers, setVolumeTiers] = useState<VolumeTier[]>([
    { minQuantity: 2, discountType: "PERCENTAGE", discountValue: 10 },
    { minQuantity: 3, discountType: "PERCENTAGE", discountValue: 15 },
    { minQuantity: 5, discountType: "PERCENTAGE", discountValue: 20 },
  ]);

  const canUseType = canUseBundleType(planKey, type);

  const handleTypeChange = (val: string) => {
    setType(val);
  };

  const handlePickProducts = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: type !== "BOGO",
    });
    if (selected) {
      setProducts(
        selected.map((item: any) => ({
          id: item.id,
          title: item.title,
          image: item.images?.[0]?.originalSrc,
          variantId: item.variants?.[0]?.id,
          variantTitle: item.variants?.[0]?.title,
          price: parseFloat(item.variants?.[0]?.price || "0"),
          quantity: 1,
          role: "MAIN",
        }))
      );
    }
  };

  const handlePickGift = async () => {
    const selected = await shopify.resourcePicker({
      type: "product",
      multiple: false,
    });
    if (selected) {
      setGiftProducts(
        selected.map((item: any) => ({
          id: item.id,
          title: item.title,
          image: item.images?.[0]?.originalSrc,
          variantId: item.variants?.[0]?.id,
          price: parseFloat(item.variants?.[0]?.price || "0"),
          quantity: 1,
          role: "GIFT",
        }))
      );
    }
  };

  const handleSave = () => {
    const allProducts = [
      ...products,
      ...giftProducts.map((p) => ({ ...p, role: "GIFT" })),
    ];
    const formData = new FormData();
    formData.append("title", title);
    formData.append("type", type);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    formData.append("products", JSON.stringify(allProducts));
    formData.append("volumeTiers", JSON.stringify(volumeTiers));
    formData.append("minSelectQty", minSelectQty);
    formData.append("maxSelectQty", maxSelectQty);
    submit(formData, { method: "post" });
  };

  const addVolumeTier = () => {
    setVolumeTiers([
      ...volumeTiers,
      { minQuantity: volumeTiers.length + 2, discountType: "PERCENTAGE", discountValue: 0 },
    ]);
  };

  const updateVolumeTier = (index: number, field: string, value: any) => {
    setVolumeTiers(volumeTiers.map((tier, i) => (i === index ? { ...tier, [field]: value } : tier)));
  };

  return (
    <Page backAction={{ content: "Bundles", url: "/app/bundles" }} title="Buat Bundle Baru">
      <TitleBar title="Buat Bundle Baru" />

      <BlockStack gap="600">
        {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}

        {!canUseType && (
          <Banner
            tone="warning"
            title={`Tipe bundle ini membutuhkan upgrade plan`}
            action={{ content: "Lihat Plans", onAction: () => navigate("/app/billing") }}
          >
            Plan {plan.name} hanya mendukung Fixed Bundle dan BOGO. Upgrade untuk unlock semua tipe bundle.
          </Banner>
        )}

        {/* Bundle Info */}
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">Informasi Bundle</Text>
            <TextField
              label="Nama Bundle"
              value={title}
              onChange={setTitle}
              placeholder="contoh: Paket Hemat Hijab Set"
              autoComplete="off"
            />
            <Select
              label="Tipe Bundle"
              options={BUNDLE_TYPES.map((bt) => ({
                ...bt,
                label: canUseBundleType(planKey, bt.value)
                  ? bt.label
                  : `🔒 ${bt.label} (Perlu upgrade)`,
                disabled: !canUseBundleType(planKey, bt.value),
              }))}
              value={type}
              onChange={handleTypeChange}
              helpText="Pilih tipe bundle yang sesuai dengan strategi penjualan Anda"
            />
          </BlockStack>
        </Card>

        {/* Mix & Match Config */}
        {type === "MIX_MATCH" && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Konfigurasi Mix & Match</Text>
              <InlineStack gap="400">
                <TextField
                  label="Min. produk dipilih"
                  type="number"
                  value={minSelectQty}
                  onChange={setMinSelectQty}
                  autoComplete="off"
                  helpText="Minimum item yang harus dipilih pembeli"
                />
                <TextField
                  label="Max. produk dipilih"
                  type="number"
                  value={maxSelectQty}
                  onChange={setMaxSelectQty}
                  autoComplete="off"
                  helpText="Maksimum item yang dapat dipilih pembeli"
                />
              </InlineStack>

              {/* Image Swatch Toggle */}
              <Box>
                {plan.hasImageSwatch ? (
                  <Checkbox
                    label="Tampilkan Image Swatch (gambar produk sebagai pilihan)"
                    checked={showImageSwatch}
                    onChange={setShowImageSwatch}
                    helpText="Pembeli akan melihat foto produk saat memilih item bundle, bukan teks saja."
                  />
                ) : (
                  <Box
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                    borderWidth="025"
                    borderColor="border"
                  >
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="span">🔒</Text>
                      <BlockStack gap="050">
                        <Text variant="bodySm" fontWeight="semibold" as="p">
                          Image Swatch — Tersedia di plan Standard+
                        </Text>
                        <Text variant="bodySm" tone="subdued" as="p">
                          Tampilkan gambar produk sebagai pilihan mix & match agar lebih menarik.
                        </Text>
                      </BlockStack>
                      <Button size="slim" onClick={() => navigate("/app/billing")}>Upgrade</Button>
                    </InlineStack>
                  </Box>
                )}
              </Box>

              {showImageSwatch && plan.hasImageSwatch && products.length > 0 && (
                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="200"
                  borderWidth="025"
                  borderColor="border"
                >
                  <BlockStack gap="200">
                    <Text variant="bodySm" fontWeight="semibold" as="p">Preview Image Swatch:</Text>
                    <InlineStack gap="200" wrap>
                      {products.map((p) => (
                        <BlockStack key={p.id} gap="100" inlineAlign="center">
                          <Box
                            borderWidth="025"
                            borderRadius="200"
                            borderColor="border-emphasis"
                            padding="050"
                          >
                            <Thumbnail
                              source={p.image || ""}
                              alt={p.title}
                              size="medium"
                            />
                          </Box>
                          <Text variant="bodySm" as="p" alignment="center">
                            {p.title.length > 15 ? p.title.substring(0, 15) + "…" : p.title}
                          </Text>
                        </BlockStack>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Box>
              )}
            </BlockStack>
          </Card>
        )}

        {/* Product Selection */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h2">
                {type === "BOGO" || type === "FREE_GIFT" ? "Produk Utama" : "Produk dalam Bundle"}
              </Text>
              <Button onClick={handlePickProducts}>+ Tambah Produk</Button>
            </InlineStack>

            {products.length === 0 ? (
              <Box padding="600" borderWidth="025" borderRadius="200" borderColor="border">
                <Text alignment="center" tone="subdued" as="p">
                  Belum ada produk. Klik "Tambah Produk" untuk memilih.
                </Text>
              </Box>
            ) : (
              <ResourceList
                resourceName={{ singular: "produk", plural: "produk" }}
                items={products}
                renderItem={(product) => (
                  <ResourceItem
                    id={product.id}
                    media={
                      product.image ? (
                        <Thumbnail source={product.image} alt={product.title} size="small" />
                      ) : undefined
                    }
                    accessibilityLabel={product.title}
                    onClick={() => {}}
                  >
                    <InlineStack align="space-between">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="semibold" as="span">{product.title}</Text>
                        <Text variant="bodySm" tone="subdued" as="span">
                          {currency} {product.price?.toFixed(2)}
                        </Text>
                      </BlockStack>
                      <Button
                        variant="plain"
                        tone="critical"
                        onClick={() => setProducts(products.filter((p) => p.id !== product.id))}
                      >
                        Hapus
                      </Button>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            )}
          </BlockStack>
        </Card>

        {/* Gift / BOGO */}
        {(type === "BOGO" || type === "FREE_GIFT") && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">
                  {type === "BOGO" ? "Produk Gratis (Get One)" : "Produk Hadiah (Free Gift)"}
                </Text>
                <Button onClick={handlePickGift}>+ Pilih Produk Hadiah</Button>
              </InlineStack>
              {giftProducts.map((p) => (
                <InlineStack key={p.id} align="space-between">
                  <InlineStack gap="300">
                    {p.image && <Thumbnail source={p.image} alt={p.title} size="small" />}
                    <BlockStack gap="100">
                      <Text variant="bodyMd" fontWeight="semibold" as="span">{p.title}</Text>
                      <Badge tone="success">GRATIS</Badge>
                    </BlockStack>
                  </InlineStack>
                  <Button variant="plain" tone="critical" onClick={() => setGiftProducts([])}>
                    Hapus
                  </Button>
                </InlineStack>
              ))}
            </BlockStack>
          </Card>
        )}

        {/* Volume Tiers */}
        {type === "VOLUME" && (
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Tier Diskon Volume</Text>
                <Button onClick={addVolumeTier}>+ Tambah Tier</Button>
              </InlineStack>
              <Text variant="bodySm" tone="subdued" as="p">
                Atur diskon berdasarkan jumlah item yang dibeli
              </Text>
              {volumeTiers.map((tier, index) => (
                <Box key={index} padding="300" borderWidth="025" borderRadius="200" borderColor="border">
                  <InlineStack gap="400" align="start">
                    <TextField
                      label="Min Qty"
                      type="number"
                      value={String(tier.minQuantity)}
                      onChange={(v) => updateVolumeTier(index, "minQuantity", parseInt(v))}
                      autoComplete="off"
                    />
                    <Select
                      label="Tipe Diskon"
                      options={[
                        { label: "Persentase (%)", value: "PERCENTAGE" },
                        { label: `Nominal (${currency})`, value: "FIXED" },
                      ]}
                      value={tier.discountType}
                      onChange={(v) => updateVolumeTier(index, "discountType", v)}
                    />
                    <TextField
                      label={tier.discountType === "PERCENTAGE" ? "Diskon (%)" : `Diskon (${currency})`}
                      type="number"
                      value={String(tier.discountValue)}
                      onChange={(v) => updateVolumeTier(index, "discountValue", parseFloat(v))}
                      autoComplete="off"
                    />
                    <Box paddingBlockStart="600">
                      <Button
                        variant="plain"
                        tone="critical"
                        onClick={() => setVolumeTiers(volumeTiers.filter((_, i) => i !== index))}
                      >
                        Hapus
                      </Button>
                    </Box>
                  </InlineStack>
                </Box>
              ))}
            </BlockStack>
          </Card>
        )}

        {/* Discount Config */}
        {type !== "VOLUME" && type !== "BOGO" && type !== "FREE_GIFT" && (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Konfigurasi Diskon</Text>
              <ChoiceList
                title="Tipe Diskon"
                choices={[
                  { label: "Persentase (misal: 15%)", value: "PERCENTAGE" },
                  { label: `Nominal tetap (misal: ${currency} 35)`, value: "FIXED" },
                ]}
                selected={[discountType]}
                onChange={(v) => setDiscountType(v[0])}
              />
              <TextField
                label={discountType === "PERCENTAGE" ? "Besar Diskon (%)" : `Besar Diskon (${currency})`}
                type="number"
                value={discountValue}
                onChange={setDiscountValue}
                suffix={discountType === "PERCENTAGE" ? "%" : currency}
                autoComplete="off"
              />
            </BlockStack>
          </Card>
        )}

        <InlineStack align="end" gap="300">
          <Button onClick={() => navigate("/app/bundles")}>Batal</Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!title || !type || !canUseType}
          >
            Simpan Bundle
          </Button>
        </InlineStack>
      </BlockStack>
    </Page>
  );
}
