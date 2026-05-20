import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  // trailingSlash ensures each page compiles to /page/index.html
  trailingSlash: true,
};

export default nextConfig;
