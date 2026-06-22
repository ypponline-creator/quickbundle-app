import {
  reactExtension,
  useApi,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Badge,
  Divider,
} from "@shopify/ui-extensions-react/admin";
import { useState, useEffect } from "react";

export default reactExtension(
  "admin.product-details.block.render",
  () => <BundleBlock />
);

function BundleBlock() {
  const { data } = useApi<"admin.product-details.block.render">();
  const [bundles, setBundles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const productId = data?.selected?.[0]?.id;

  useEffect(() => {
    if (!productId) return;

    fetch(`/api/bundles/by-product?productId=${encodeURIComponent(productId)}`)
      .then((r) => r.json())
      .then((data) => {
        setBundles(data.bundles || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <BlockStack gap="base">
        <Text>Memuat bundle...</Text>
      </BlockStack>
    );
  }

  return (
    <BlockStack gap="base">
      <Text fontWeight="bold" size="large">
        QuickBundle - Bundle Aktif
      </Text>
      <Divider />
      {bundles.length === 0 ? (
        <BlockStack gap="small">
          <Text tone="subdued">Produk ini belum termasuk dalam bundle manapun.</Text>
          <Button
            onPress={() => {
              open("/app/bundles/new", "_blank");
            }}
          >
            + Buat Bundle untuk Produk Ini
          </Button>
        </BlockStack>
      ) : (
        <BlockStack gap="base">
          {bundles.map((bundle: any) => (
            <BlockStack key={bundle.id} gap="small">
              <InlineStack blockAlignment="center" gap="small">
                <Text fontWeight="semibold">{bundle.title}</Text>
                <Badge
                  tone={bundle.status === "ACTIVE" ? "success" : "critical"}
                >
                  {bundle.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
                </Badge>
              </InlineStack>
              <Text tone="subdued" size="small">
                {bundle.type} ·{" "}
                {bundle.discountType === "PERCENTAGE"
                  ? `${bundle.discountValue}% off`
                  : `$${bundle.discountValue} off`}
              </Text>
            </BlockStack>
          ))}
          <Button
            onPress={() => {
              open("/app/bundles/new", "_blank");
            }}
          >
            + Tambah Bundle Baru
          </Button>
        </BlockStack>
      )}
    </BlockStack>
  );
}
