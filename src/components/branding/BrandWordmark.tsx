import { BRAND_ASSETS, BRAND_NAME } from "@/branding/brand";

type BrandWordmarkProps = {
  theme?: "light" | "dark";
  className?: string;
};

export function BrandWordmark({ theme = "dark", className }: BrandWordmarkProps) {
  const src = theme === "light" ? BRAND_ASSETS.wordmarkLight : BRAND_ASSETS.wordmarkDark;

  return <img src={src} alt={BRAND_NAME} className={className} />;
}
