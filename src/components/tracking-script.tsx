"use client";

import Script from "next/script";

export default function TrackingScript() {
  return (
    <>
      {/* AgentKong development tracking script */}
      <Script
        src="https://development.agentkong.ai/api/widgets/cmhpssmbo0001lb04m0k5bcbe.js"
        strategy="afterInteractive"
        onLoad={() => {
          console.log("✅ AgentKong development tracking loaded via Next.js Script");
        }}
        onError={(e) => {
          console.error("❌ AgentKong development tracking failed to load:", e);
        }}
      />

      {/* AgentKong tracking script */}
      <Script
        src="https://portforward.kavithakanchana.xyz/api/widgets/cmguhbcxv0001vdrok0hn8ml2.js?v=4"
        strategy="afterInteractive"
        onLoad={() => {
          console.log('✅ AgentKong tracking loaded via Next.js Script');
        }}
        onError={(e) => {
          console.error('❌ AgentKong tracking failed to load:', e);
        }}
      />
      
      {/* Meta Pixel Code */}
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        onError={() => {
          // Silently handle ad blocker interference - this is expected behavior
        }}
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '4754032708155206');
            fbq('track', 'PageView');
          `,
        }}
      />
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: 'none' }}
          src="https://www.facebook.com/tr?id=4754032708155206&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>
    </>
  );
}
