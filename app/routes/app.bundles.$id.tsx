import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useSearchParams } from "@remix-run/react";
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
  Badge,
  Thumbnail,
  ResourceList,
  ResourceItem,
  Banner,
  Box,
  Divider,
  ChoiceList,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState } from "react";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [bundle, settings] = await Promise.all([
    prisma.bundle.findFirst({
      where: { id: params.id, shop: session.shop },
      include: { products: true, volumeTiers: true },
    }),
    prisma.shopSettings.findUnique({ where: { shop: session.shop } }),
  ]);

  if (!bundle) throw new Response("Not Found", { status: 404 });
  return json({ bundle, currency: settings?.currency || "MYR" });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    await prisma.bundle.deleteMany({
      where: { id: params.id, shop: session.shop },
    });
    return redirect("/app/bundles");
  }

  if (intent === "toggle") {
    const bundle = await prisma.bundle.findFirst({ where: { id: params.id } });
    await prisma.bundle.update({
      where: { id: params.id },
      data: { status: bundle?.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
    });
    return json({ ok: true });
  }

  if (intent === "update") {
    const title = formData.get("title") as string;
    const discountType = formData.get("discountType") as string;
    const discountValue = parseFloat(formData.get("discountValue") as string) || 0;
    const productsJson = formData.get("products") as string;
    const volumeTiersJson = formData.get("volumeTiers") as string;
    const products = productsJson ? JSON.parse(productsJson) : [];
    const volumeTiers = volumeTiersJson ? JSON.parse(volumeTiersJson) : [];

    await prisma.bundle.update({
      where: { id: params.id },
      data: { title, discountType, discountValue },
    });

    await prisma.bundleProduct.deleteMany({ where: { bundleId: params.id } });
    await prisma.bundleProduct.createMany({
      data: products.map((p: any) => ({
        bundleId: params.id!,
        productId: p.id || p.productId,
        productTitle: p.title || p.productTitle,
        productImage: p.image || p.productImage,
        variantId: p.variantId,
        price: p.price || 0,
        quantity: p.quantity || 1,
        isRequired: true,
        role: p.role || "MAIN",
      })),
    });

    if (volumeTiers.length > 0) {
      await prisma.volumeTier.deleteMany({ where: { bundleId: params.id } });
      await prisma.volumeTier.createMany({
        data: volumeTiers.map((t: any) => ({
          bundleId: params.id!,
          minQuantity: t.minQuantity,
          discountType: t.discountType || "PERCENTAGE",
          discountValue: t.discountValue,
        })),
      });
    }

    return json({ ok: true, updated: true });
  }

  return json({ ok: false });
};

export default function EditBundle() {
  const { bundle, currency } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get("created") === "true";

  const shopify = useAppBridge();
  const [title, setTitle] = useState(bundle.title);
  const [discountType, setDiscountType] = useState(bundle.discountType);
  const [discountValue, setDiscountValue] = useState(String(bundle.discountValue));
  const [products, setProducts] = useState(bundle.products);
  const [volumeTiers, setVolumeTiers] = useState(
    bundle.volumeTiers?.length > 0
      ? bundle.volumeTiers
      : [{ minQuantity: 2, discountType: "PERCENTAGE", discountValue: 10 }]
  );

  const updateVolumeTier = (index: number, field: string, value: any) => {
    setVolumeTiers(volumeTiers.map((t: any, i: number) => i === index ? { ...t, [field]: value } : t));
  };

  const handlePickProducts = async () => {
    const selected = await shopify.resourcePicker({ type: "product", multiple: true, showVariants: false });
    if (selected) {
      setProducts(selected.map((item: any) => ({
        id: item.id,
        productId: item.id,
        title: item.title,
        productTitle: item.title,
        image: item.images?.[0]?.originalSrc,
        productImage: item.images?.[0]?.originalSrc,
        variantId: item.variants?.[0]?.id,
        price: parseFloat(item.variants?.[0]?.price || "0"),
        quantity: 1,
        role: "MAIN",
      })));
    }
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("intent", "update");
    formData.append("title", title);
    formData.append("discountType", discountType);
    formData.append("discountValue", discountValue);
    formData.append("products", JSON.stringify(products));
    formData.append("volumeTiers", JSON.stringify(volumeTiers));
    submit(formData, { method: "post" });
  };

  const handleToggle = () => {
    submit({ intent: "toggle" }, { method: "post" });
  };

  const handleDelete = () => {
    if (confirm("Yakin hapus bundle ini?")) {
      submit({ intent: "delete" }, { method: "post" });
    }
  };

  const BUNDLE_TYPE_LABELS: Record<string, string> = {
    FIXED: "Fixed Bundle",
    MIX_MATCH: "Mix & Match",
    BOGO: "BOGO",
    FREE_GIFT: "Free Gift",
    VOLUME: "Volume Discount",
    CROSS_SELL: "Cross-sell",
  };

  return (
    <Page
      backAction={{ content: "Bundles", url: "/app/bundles" }}
      title={title}
      titleMetadata={
        <Badge tone={bundle.status === "ACTIVE" ? "success" : "critical"}>
          {bundle.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
        </Badge>
      }
      secondaryActions={[
        {
          content: bundle.status === "ACTIVE" ? "Nonaktifkan" : "Aktifkan",
          onAction: handleToggle,
        },
        {
          content: "Hapus Bundle",
          destructive: true,
          onAction: handleDelete,
        },
      ]}
    >
      <TitleBar title={`Edit: ${bundle.title}`} />

      <BlockStack gap="600">
        {justCreated && (
          <Banner tone="success" title="Bundle berhasil dibuat!">
            <p>Bundle Anda sudah aktif dan akan muncul di halaman produk toko.</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              {/* Bundle Info */}
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Informasi Bundle</Text>
                  <TextField
                    label="Nama Bundle"
                    value={title}
                    onChange={setTitle}
                    autoComplete="off"
                  />
                  <InlineStack gap="300">
                    <Badge>{BUNDLE_TYPE_LABELS[bundle.type] || bundle.type}</Badge>
                    <Text variant="bodySm" tone="subdued" as="span">
                      Tipe tidak bisa diubah setelah dibuat
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* Products */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingMd" as="h2">Produk dalam Bundle</Text>
                    <Button onClick={handlePickProducts}>Ubah Produk</Button>
                  </InlineStack>

                  <ResourceList
                    resourceName={{ singular: "produk", plural: "produk" }}
                    items={products}
                    renderItem={(product: any) => (
                      <ResourceItem
                        id={product.id || product.productId}
                        media={
                          (product.image || product.productImage) ? (
                            <Thumbnail
                              source={product.image || product.productImage}
                              alt={product.title || product.productTitle}
                              size="small"
                            />
                          ) : undefined
                        }
                        accessibilityLabel={product.productTitle}
                        onClick={() => {}}
                      >
                        <InlineStack align="space-between">
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="semibold" as="span">
                              {product.title || product.productTitle}
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="span">
                              {currency} {(product.price || 0).toFixed(2)} · Qty: {product.quantity}
                            </Text>
                          </BlockStack>
                          {product.role === "GIFT" && <Badge tone="success">GIFT</Badge>}
                        </InlineStack>
                      </ResourceItem>
                    )}
                  />
                </BlockStack>
              </Card>

              {/* Volume Tiers Editor */}
              {bundle.type === "VOLUME" && (
                <Card>
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text variant="headingMd" as="h2">Tier Diskon Volume</Text>
                      <Button onClick={() => setVolumeTiers([...volumeTiers, { minQuantity: volumeTiers.length + 2, discountType: "PERCENTAGE", discountValue: 0 }])}>
                        + Tambah Tier
                      </Button>
                    </InlineStack>
                    <Text variant="bodySm" tone="subdued" as="p">
                      Contoh: beli 2 pcs = diskon 31.82% → total 75 MYR dari 110 MYR
                    </Text>
                    {volumeTiers.map((tier: any, index: number) => (
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
                              { label: "Nominal ($)", value: "FIXED" },
                            ]}
                            value={tier.discountType}
                            onChange={(v) => updateVolumeTier(index, "discountType", v)}
                          />
                          <TextField
                            label={tier.discountType === "PERCENTAGE" ? "Diskon (%)" : "Diskon ($)"}
                            type="number"
                            value={String(tier.discountValue)}
                            onChange={(v) => updateVolumeTier(index, "discountValue", parseFloat(v))}
                            autoComplete="off"
                          />
                          <Box paddingBlockStart="600">
                            <Button variant="plain" tone="critical"
                              onClick={() => setVolumeTiers(volumeTiers.filter((_: any, i: number) => i !== index))}>
                              Hapus
                            </Button>
                          </Box>
                        </InlineStack>
                      </Box>
                    ))}
                  </BlockStack>
                </Card>
              )}

              {/* Discount */}
              {bundle.type !== "BOGO" && bundle.type !== "FREE_GIFT" && bundle.type !== "VOLUME" && (
                <Card>
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Konfigurasi Diskon</Text>
                    <ChoiceList
                      title="Tipe Diskon"
                      choices={[
                        { label: "Persentase (%)", value: "PERCENTAGE" },
                        { label: `Nominal tetap (${currency})`, value: "FIXED" },
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
            </BlockStack>
          </Layout.Section>

          {/* Sidebar */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Status Bundle</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">Status</Text>
                    <Badge tone={bundle.status === "ACTIVE" ? "success" : "critical"}>
                      {bundle.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">Tipe</Text>
                    <Text as="span" variant="bodyMd">{BUNDLE_TYPE_LABELS[bundle.type]}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">Diskon</Text>
                    <Text as="span" variant="bodyMd">
                      {bundle.discountType === "PERCENTAGE"
                        ? `${bundle.discountValue}%`
                        : `${currency} ${bundle.discountValue}`}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd">Produk</Text>
                    <Text as="span" variant="bodyMd">{products.length} item</Text>
                  </InlineStack>
                  <Divider />
                  <Button variant="primary" onClick={handleSave} fullWidth>
                    Simpan Perubahan
                  </Button>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text variant="headingMd" as="h2">Preview Bundle</Text>
                  <Box
                    padding="300"
                    background="bg-surface-secondary"
                    borderRadius="200"
                  >
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h3">{title || "Nama Bundle"}</Text>
                      {products.slice(0, 2).map((p: any) => (
                        <InlineStack key={p.id || p.productId} gap="200" align="start">
                          <Text as="span">•</Text>
                          <Text variant="bodySm" as="span">
                            {p.title || p.productTitle}
                          </Text>
                        </InlineStack>
                      ))}
                      {products.length > 2 && (
                        <Text variant="bodySm" tone="subdued" as="p">
                          +{products.length - 2} produk lainnya
                        </Text>
                      )}
                      <Divider />
                      <Badge tone="success">
                        Hemat{" "}
                        {discountType === "PERCENTAGE"
                          ? `${discountValue}%`
                          : `${currency} ${discountValue}`}
                      </Badge>
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
