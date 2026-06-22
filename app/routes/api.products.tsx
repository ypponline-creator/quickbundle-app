import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  const response = await admin.graphql(`
    query SearchProducts($query: String!) {
      products(first: 20, query: $query) {
        edges {
          node {
            id
            title
            status
            images(first: 1) {
              edges { node { url altText } }
            }
            variants(first: 1) {
              edges {
                node {
                  id
                  title
                  price
                  compareAtPrice
                }
              }
            }
          }
        }
      }
    }
  `, { variables: { query } });

  const { data } = await response.json();
  const products = data.products.edges.map(({ node }: any) => ({
    id: node.id,
    title: node.title,
    image: node.images.edges[0]?.node?.url,
    variantId: node.variants.edges[0]?.node?.id,
    variantTitle: node.variants.edges[0]?.node?.title,
    price: parseFloat(node.variants.edges[0]?.node?.price || "0"),
    compareAtPrice: parseFloat(node.variants.edges[0]?.node?.compareAtPrice || "0"),
  }));

  return json({ products });
};
