import Link from "next/link";
import type { Material } from "@/types/material";

const coverColors = [
  "#365927",
  "#4a7a38",
  "#2d4a22",
  "#5a8c4a",
  "#3d6b2e",
  "#6b9e5a",
  "#2a5020",
  "#4d7040",
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
