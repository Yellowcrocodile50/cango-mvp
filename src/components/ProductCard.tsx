import Link from "next/link";
import type { Material } from "@/types/material";

const coverColors = [
  "#1a3312",  // L≈14%
  "#1f3b16",  // L≈17%
  "#254319",  // L≈19%
  "#2a4b1d",  // L≈21%
  "#2f5221",  // L≈23%
  "#345a25",  // L≈25%
  "#365927",  // L≈27%
  "#3c622c",  // L≈29%
  "#3d6b2e",  // L≈31%
  "#437232",  // L≈33%
  "#497a36",  // L≈36%
  "#4a7a38",  // L≈38%
  "#548b40",  // L≈40%
  "#5a8c4a",  // L≈42%
  "#609c4b",  // L≈45%
  "#6b9e5a",  // L≈48%
  "#74b65d",  // L≈52%
  "#7bbf64",  // L≈56%
  "#82c76a",  // L≈59%
  "#8ad071",  // L≈63%
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return coverColors[Math.abs(hash) % coverColors.length];
}

export default function ProductCard({ material }: { material: Material }) {
  const bgColor = colorForId(material.id);

  return (
    <Link href={`/product/${material.id}`} className="group block">
      <div className="aspect-square rounded-lg overflow-hidden mb-3 relative shadow-sm">
        {material.thumbnail_url ? (
          <img
            src={material.thumbnail_url}
            alt={material.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-white font-bold text-lg p-6 text-center leading-tight group-hover:scale-105 transition-transform duration-300"
            style={{ background: bgColor }}
          >
            {material.title}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium leading-snug line-clamp-2 text-[#1a2e16] group-hover:text-[#365927] transition">
          {material.title}
        </h3>
        <p className="text-sm font-bold text-[#365927]">
          {material.price.toLocaleString()}원
        </p>
      </div>
    </Link>
  );
}
