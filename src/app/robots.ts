import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/supplier/", "/mypage/", "/checkout/", "/cart/", "/api/"],
    },
    sitemap: "https://cango.kr/sitemap.xml",
  };
}
