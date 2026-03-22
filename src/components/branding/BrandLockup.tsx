import { BRAND_ASSETS, BRAND_NAME, BRAND_SLOGAN_SECONDARY } from "@/branding/brand";

type BrandLockupProps = {
  theme?: "light" | "dark";
  className?: string;
  showSlogan?: boolean;
};

export function BrandLockup({ theme = "dark", className, showSlogan = false }: BrandLockupProps) {
  const src = theme === "light" ? BRAND_ASSETS.logoFallbackLight : BRAND_ASSETS.logoFallbackDark;
  const alt = showSlogan ? `${BRAND_NAME} — ${BRAND_SLOGAN_SECONDARY}` : BRAND_NAME;

  return <img src={src} alt={alt} className={className} />;
}
