import Script from "next/script";

type Props = {
  googleAnalyticsId?: string | null;
  googleTagManagerId?: string | null;
  facebookPixelId?: string | null;
  customHeadHtml?: string | null;
};

export function AnalyticsScripts({
  googleAnalyticsId,
  googleTagManagerId,
  facebookPixelId,
  customHeadHtml,
}: Props) {
  return (
    <>
      {googleTagManagerId ? (
        <>
          <Script
            id="gtm"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${googleTagManagerId}');`,
            }}
          />
        </>
      ) : null}
      {googleAnalyticsId && !googleTagManagerId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAnalyticsId}', { anonymize_ip: true });`,
            }}
          />
        </>
      ) : null}
      {facebookPixelId ? (
        <Script
          id="fb-pixel"
          strategy="afterInteractive"
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
fbq('init', '${facebookPixelId}');
fbq('track', 'PageView');`,
          }}
        />
      ) : null}
      {customHeadHtml ? (
        <Script
          id="custom-head"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: customHeadHtml }}
        />
      ) : null}
    </>
  );
}
