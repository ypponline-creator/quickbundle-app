export type PlanKey = "FREE" | "BASIC" | "STANDARD" | "GROWTH" | "ENTERPRISE";

export interface Plan {
  key: PlanKey;
  name: string;
  price: number;
  revenueLimit: number | null; // null = unlimited
  revenueLabelMonthly: string;
  description: string;
  features: string[];
  notIncluded: string[];
  hasBranding: boolean;
  hasImageSwatch: boolean;
  hasAdvancedAnalytics: boolean;
  hasCartDetection: boolean;
  hasCustomAnalytics: boolean;
  supportSLA: string;
  popular?: boolean;
  enterprise?: boolean;
}

export const PLANS: Plan[] = [
  {
    key: "FREE",
    name: "Free",
    price: 0,
    revenueLimit: 500,
    revenueLabelMonthly: "Hingga $500/bln",
    description: "Untuk coba-coba & development store",
    features: [
      "Fixed Bundle & BOGO",
      "Hingga $500/bln bundle revenue",
      "Widget dasar",
      "Email support",
    ],
    notIncluded: [
      "Mix & Match",
      "Volume Discount",
      "Free Gift",
      "Image Swatch",
      "Analytics lanjutan",
    ],
    hasBranding: true,
    hasImageSwatch: false,
    hasAdvancedAnalytics: false,
    hasCartDetection: false,
    hasCustomAnalytics: false,
    supportSLA: "Email (SLA 24 jam)",
  },
  {
    key: "BASIC",
    name: "Basic",
    price: 9.99,
    revenueLimit: 1000,
    revenueLabelMonthly: "Hingga $1K/bln",
    description: "Untuk toko baru yang mulai jualan",
    features: [
      "Semua tipe bundle",
      "Hingga $1K/bln bundle revenue",
      "Widget kustom (warna & posisi)",
      "Branding dapat dihapus atas permintaan",
      "Live chat support (SLA 30 mnt)",
    ],
    notIncluded: [
      "Image Swatch",
      "Analytics lanjutan",
      "Cart Detection",
    ],
    hasBranding: true,
    hasImageSwatch: false,
    hasAdvancedAnalytics: false,
    hasCartDetection: false,
    hasCustomAnalytics: false,
    supportSLA: "Live chat (SLA 30 mnt)",
  },
  {
    key: "STANDARD",
    name: "Standard",
    price: 24.99,
    revenueLimit: 3000,
    revenueLabelMonthly: "Hingga $3K/bln",
    description: "Untuk toko yang sedang berkembang",
    features: [
      "Semua tipe bundle",
      "Hingga $3K/bln bundle revenue",
      "Image Swatch untuk Mix & Match",
      "Tanpa branding QuickBundle",
      "Analytics dasar per bundle",
      "Live chat support (SLA 30 mnt)",
    ],
    notIncluded: [
      "Analytics lanjutan",
      "Cart Detection otomatis",
    ],
    hasBranding: false,
    hasImageSwatch: true,
    hasAdvancedAnalytics: false,
    hasCartDetection: false,
    hasCustomAnalytics: false,
    supportSLA: "Live chat (SLA 30 mnt)",
    popular: true,
  },
  {
    key: "GROWTH",
    name: "Growth",
    price: 49.99,
    revenueLimit: 10000,
    revenueLabelMonthly: "Hingga $10K/bln",
    description: "Untuk toko yang sudah scale",
    features: [
      "Semua fitur Standard",
      "Hingga $10K/bln bundle revenue",
      "Analytics lanjutan (konversi, AOV per bundle)",
      "Export laporan CSV",
      "Priority live chat (SLA 15 mnt)",
    ],
    notIncluded: [
      "Cart Detection otomatis",
      "Account manager",
    ],
    hasBranding: false,
    hasImageSwatch: true,
    hasAdvancedAnalytics: true,
    hasCartDetection: false,
    hasCustomAnalytics: false,
    supportSLA: "Priority chat (SLA 15 mnt)",
  },
  {
    key: "ENTERPRISE",
    name: "Enterprise",
    price: 99.99,
    revenueLimit: null,
    revenueLabelMonthly: "Unlimited",
    description: "Untuk toko skala besar",
    features: [
      "Semua fitur Growth",
      "Revenue tidak terbatas",
      "Automatic Cart Bundle Detection",
      "Laporan analytics kustom",
      "Dedicated account manager",
      "Priority support (SLA 5 mnt)",
    ],
    notIncluded: [],
    hasBranding: false,
    hasImageSwatch: true,
    hasAdvancedAnalytics: true,
    hasCartDetection: true,
    hasCustomAnalytics: true,
    supportSLA: "Dedicated (SLA 5 mnt)",
    enterprise: true,
  },
];

export function getPlan(key: string): Plan {
  return PLANS.find((p) => p.key === key) ?? PLANS[0];
}

export function canUseBundleType(planKey: string, bundleType: string): boolean {
  const freePlan = ["FREE"];
  const restrictedOnFree = ["MIX_MATCH", "VOLUME", "FREE_GIFT", "CROSS_SELL"];
  if (freePlan.includes(planKey) && restrictedOnFree.includes(bundleType)) {
    return false;
  }
  return true;
}

export function isRevenueExceeded(planKey: string, monthlyRevenue: number): boolean {
  const plan = getPlan(planKey);
  if (!plan.revenueLimit) return false;
  return monthlyRevenue >= plan.revenueLimit;
}

export function getRevenuePercent(planKey: string, monthlyRevenue: number): number {
  const plan = getPlan(planKey);
  if (!plan.revenueLimit) return 0;
  return Math.min((monthlyRevenue / plan.revenueLimit) * 100, 100);
}
