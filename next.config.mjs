const atlasSourceFiles = ['./plans/**/*.md', './atlas/items/**/*.md'];

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/': atlasSourceFiles,
      '/runtime': atlasSourceFiles,
    },
  },
};

export default nextConfig;
