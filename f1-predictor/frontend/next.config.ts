import type { NextConfig } from "next";
                                                                                                                                                                                                  
  const nextConfig: NextConfig = {                                                                                                                                                              
    output: "export",
    basePath: "/box-box",
    assetPrefix: "/box-box",
    trailingSlash: true,
    images: { unoptimized: true },
  };

  export default nextConfig;
