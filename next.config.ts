import type { NextConfig } from 'next';
const config:NextConfig={distDir:process.env.CORTEX_NEXT_DIST_DIR??'.next',devIndicators:false,turbopack:{root:process.cwd()}};
export default config;
