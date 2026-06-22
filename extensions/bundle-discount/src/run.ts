import type { RunInput, FunctionRunResult } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = { discounts: [] };

export function run(input: RunInput): FunctionRunResult {
  const configMetafield = input.discountNode?.metafield?.value;
  if (!configMetafield) return EMPTY_DISCOUNT;

  let config: any;
  try {
    config = JSON.parse(configMetafield);
  } catch {
    return EMPTY_DISCOUNT;
  }

  const { bundleType, discountType, discountValue, productIds } = config;

  if (!productIds || productIds.length === 0) return EMPTY_DISCOUNT;

  const cartProductIds = input.cart.lines
    .map((line) =>
      line.merchandise.__typename === "ProductVariant"
        ? line.merchandise.product.id
        : null
    )
    .filter(Boolean);

  const allProductsInCart = productIds.every((id: string) =>
    cartProductIds.includes(id)
  );

  if (!allProductsInCart) return EMPTY_DISCOUNT;

  const discountTargets = input.cart.lines
    .filter((line) => {
      if (line.merchandise.__typename !== "ProductVariant") return false;
      return productIds.includes(line.merchandise.product.id);
    })
    .map((line) => ({
      cartLine: { id: line.id },
    }));

  if (discountTargets.length === 0) return EMPTY_DISCOUNT;

  const value =
    discountType === "PERCENTAGE"
      ? { percentage: { value: String(discountValue) } }
      : { fixedAmount: { amount: String(discountValue) } };

  return {
    discounts: [
      {
        message: `Bundle Discount: ${discountValue}${discountType === "PERCENTAGE" ? "%" : " off"}`,
        targets: discountTargets,
        value,
      },
    ],
  };
}
