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

export function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return coverColors[Math.abs(hash) % coverColors.length];
}
