"use client";

import Script from "next/script";

export default function TrackingScript() {
  return (
    <Script
      src="https://portforward.kavithakanchana.xyz/api/widgets/cmg6hgffq0003vdfkhq84guci.js?v=4"
      strategy="afterInteractive"
      onLoad={() => {
        console.log('✅ AgentKong tracking loaded via Next.js Script');
      }}
      onError={(e) => {
        console.error('❌ AgentKong tracking failed to load:', e);
      }}
    />
  );
}
