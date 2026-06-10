/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ad creatives come from Facebook's CDN; allow them as <img> sources.
  images: { unoptimized: true },
};
export default nextConfig;
