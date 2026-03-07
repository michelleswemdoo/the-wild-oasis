/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dzeehggtelsudlpywcrw.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/cabins-images/**',
      },
    ],
  },
  // output: "export",
};

export default nextConfig;
