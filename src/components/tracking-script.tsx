"use client";

import Script from "next/script";

export default function TrackingScript() {
  return (
    <>
      {/* Cortana AI tracking pixel */}
      <Script
        src="https://app.usecortana.ai/api/hub/v1/cmqp4fx5200adi9041c7skj20"
        strategy="afterInteractive"
        async
      />
    </>
  );
}
