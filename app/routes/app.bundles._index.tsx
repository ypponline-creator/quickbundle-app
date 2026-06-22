import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  IndexTable,
  EmptyState,
  Filters,
  ChoiceList,
  useIndexResourceState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useState, useCallback } from "react";

const BUNDLE_TYPE_LABELS: Record<string, string> = {
  FIXED: "Fixed Bundle",
  MIX_MATCH: "Mix & Match",
  BOGO: "BOGO",
  FREE_GIFT: "Free Gift",
  VOLUME: "Volume Discount",
  CROSS_SELL: "Cross-sell",
};

const BUNDLE_TYPE_BADGES: Record<string, "info" | "success" | "warning" | "critical" | "new"> = {
  FIXED: "info",
  MIX_MATCH: "new",
  BOGO: "critical",
  FREE_GIFT: "warning",
  VOLUME: "success",
  CROSS_SELL: "info",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const type = url.searchParams.get("type") || "";

  const where: any = { shop: session.shop };
  if (status) where.status = status;
  if (type) where.type = type;

  const bundles = await prisma.bundle.findMany({
    where,
    include: {
      products: { take: 3 },
      _count: { select: { products: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return json({ bundles });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");
  const ids = formData.getAll("ids") as string[];

  if (action === "delete") {
    await prisma.bundle.deleteMany({
      where: { id: { in: ids }, shop: session.shop },
    });
  }

  if (action === "toggle_status") {
    const currentStatus = formData.get("currentStatus") as string;
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await prisma.bundle.updateMany({
      where: { id: { in: ids }, shop: session.shop },
      data: { status: newStatus },
    });
  }

  return json({ ok: true });
};

export default function BundleList() {
  const { bundles } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const resourceName = { singular: "bundle", plural: "bundles" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(bundles);

  const handleDelete = () => {
    submit(
      { action: "delete", ids: selectedResources },
      { method: "post" }
    );
  };

  const promotedBulkActions = [
    {
      content: "Hapus Bundle",
      destructive: true,
      onAction: handleDelete,
    },
  ];

  const rowMarkup = bundles.map((bundle, index) => (
    <IndexTable.Row
      id={bundle.id}
      key={bundle.id}
      selected={selectedResources.includes(bundle.id)}
      position={index}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {bundle.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={BUNDLE_TYPE_BADGES[bundle.type] || "info"}>
          {BUNDLE_TYPE_LABELS[bundle.type] || bundle.type}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" tone="subdued">
          {bundle._count.products} produk
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {bundle.discountType === "PERCENTAGE"
          ? `${bundle.discountValue}% off`
          : `$${bundle.discountValue} off`}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={bundle.status === "ACTIVE" ? "success" : "critical"}>
          {bundle.status === "ACTIVE" ? "Aktif" : "Nonaktif"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button size="slim" onClick={() => navigate(`/app/bundles/${bundle.id}`)}>
          Edit
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  if (bundles.length === 0) {
    return (
      <Page>
        <TitleBar title="Bundles">
          <button variant="primary" onClick={() => navigate("/app/bundles/new")}>
            + Buat Bundle
          </button>
        </TitleBar>
        <Card>
          <EmptyState
            heading="Belum ada bundle"
            action={{ content: "Buat Bundle Pertama", onAction: () => navigate("/app/bundles/new") }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Buat bundle produk untuk meningkatkan penjualan toko Anda.</p>
          </EmptyState>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Semua Bundles">
        <button variant="primary" onClick={() => navigate("/app/bundles/new")}>
          + Buat Bundle
        </button>
      </TitleBar>
      <Card padding="0">
        <IndexTable
          resourceName={resourceName}
          itemCount={bundles.length}
          selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
          onSelectionChange={handleSelectionChange}
          promotedBulkActions={promotedBulkActions}
          headings={[
            { title: "Nama Bundle" },
            { title: "Tipe" },
            { title: "Produk" },
            { title: "Diskon" },
            { title: "Status" },
            { title: "Aksi" },
          ]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </Page>
  );
}
