window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('js',new Date());
gtag('config','G-W6C5E1N64E',{allow_google_signals:false,allow_ad_personalization_signals:false,page_location:location.origin+location.pathname,page_referrer:document.referrer?new URL(document.referrer).origin:''});
const gaScript=document.createElement('script');gaScript.async=true;gaScript.src='https://www.googletagmanager.com/gtag/js?id=G-W6C5E1N64E';document.head.append(gaScript);
document.querySelectorAll('[data-soon]').forEach((button,index)=>button.addEventListener('click',()=>gtag('event','coming_soon_click',{button_position:index+1})));
document.querySelectorAll('[data-contact-creator]').forEach(button=>button.addEventListener('click',()=>gtag('event','creator_contact_open')));
