const atlasSourceFiles = ['./plans/**/*.md', './atlas/items/**/*.md'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Shiki is ESM-only. Bundling it keeps Turbopack from treating it as a
  // CommonJS server external during local development. Keep the production
  // Webpack bundle unchanged.
  ...(process.env.TURBOPACK ? { transpilePackages: ['shiki'] } : {}),
  experimental: {
    outputFileTracingIncludes: {
      '/': atlasSourceFiles,
      '/runtime': atlasSourceFiles,
      '/api/ingress/*': atlasSourceFiles,
    },
  },
};

export default nextConfig;
