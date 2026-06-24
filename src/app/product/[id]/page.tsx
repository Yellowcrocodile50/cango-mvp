import { cache } from "react";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getCategoryLabel, isFreeCategory } from "@/data/categories";
import type { Material } from "@/types/material";
import ProductDetailClient from "./ProductDetailClient";

const SITE_URL = "https://www.cango.kr";

const getMaterial = cache(async (id: string): Promise<Material | null> => {
  const { data } = await supabaseServer
    .from("materials")
    .select("*")
    .eq("id", id)
    .eq("is_deleted", false)
    .maybeSingle();
  return data;
});

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const material = await getMaterial(id);

  if (!material) {
    return { title: "자료를 찾을 수 없습니다 | CANGO" };
  }

  const isFree = isFreeCategory(material.category);
  const categoryLabel = getCategoryLabel(material.category);
  const priceText = isFree ? "무료" : `${material.price.toLocaleString()}원`;
  const url = `${SITE_URL}/product/${material.id}`;

  const title = `${material.title} | CANGO`;
  const description =
    material.description ??
    `${categoryLabel} ${priceText} 입시 자료. 선배들이 직접 만든 검증된 자료를 CANGO에서 확인하세요.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      ...(material.thumbnail_url && {
        images: [{ url: material.thumbnail_url, alt: material.title }],
      }),
    },
  };
}

export default async function ProductDetailPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const material = await getMaterial(id);

  if (!material) notFound();

  const isFree = isFreeCategory(material.category);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: material.title,
    ...(material.description && { description: material.description }),
    url: `${SITE_URL}/product/${material.id}`,
    brand: { "@type": "Brand", name: "CANGO" },
    ...(material.thumbnail_url && { image: material.thumbnail_url }),
    offers: {
      "@type": "Offer",
      priceCurrency: "KRW",
      price: isFree ? 0 : material.price,
      availability: "https://schema.org/InStock",
      url: `${SITE_URL}/product/${material.id}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ProductDetailClient material={material} />
    </>
  );
}
