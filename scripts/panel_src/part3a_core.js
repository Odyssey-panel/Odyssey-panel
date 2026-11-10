<script>
/* ================= Bashаr Panel — offline interactive demo ================= */
/* ================= i18n ================= */
var I18N = {
fa:{
 dir:'rtl',
 nav_main:'منو', nav_ops:'عملیات',
 dashboard:'داشبورد', users:'کاربران', nodes:'نودها و ورکرها', scanner:'اسکنر',
 plans:'پلن‌ها', orders:'سفارش‌ها', settings:'تنظیمات', logout:'خروج از حساب',
 sub_dashboard:'خلاصه‌ی امروز شبکه‌ی شما', sub_users:'مشترکین و اشتراک‌ها', sub_nodes:'سلامت سرورها و ورکرها',
 sub_scanner:'اسکن IP، پورت و SNI', sub_plans:'پلن‌های فروش ربات تلگرام', sub_orders:'فروش از طریق ربات تلگرام',
 sub_settings:'پیکربندی پنل',
 auth_title:'ورود به پنل', auth_sub:'برای ادامه، رمز مدیر را وارد کنید', auth_pw:'رمز عبور مدیر',
 auth_btn:'ورود به پنل', auth_hint:'رمز پیش‌فرض:', auth_tag:'مدیریت حرفه‌ای کاربران، اشتراک‌ها و نودها — همه‌چیز در یک پنل ساده',
 feat1:'ساخت خودکار کانفیگ، اشتراک و QR', feat2:'فروش خودکار با ربات تلگرام و رسید پرداخت', feat3:'مانیتورینگ نودها، تله‌متری و اسکنر',
 hello:'سلام رئیس 👋', hello_sub:'امروز شبکه‌ات سرحال است — خلاصه‌ی وضعیت:', today:'امروز، ۱۸ آبان ۱۴۰۵', welcome:'سلام رئیس! خوش آمدید 👋',
 st_users:'کاربران فعال', st_users_sub:'۱ منقضی · ۱ غیرفعال', st_rev:'درآمد این ماه', st_rev_sub:'۱۲ فروش از طریق تلگرام',
 st_nodes:'نودهای آنلاین', st_nodes_sub:'میانگین تأخیر ۳۱ میلی‌ثانیه', st_ord:'سفارش‌های در انتظار', st_ord_sub:'نیازمند بررسی شما',
 traffic:'ترافیک ۷ روز اخیر', traffic_sub:'مجموع همه‌ی کاربران', lg_down:'دانلود', lg_up:'آپلود', gb:'GB',
 panel_url:'لینک پنل', panel_url_sub:'مبنای لینک‌های اشتراک و QR — با تغییر دامنه هم کار می‌کند',
 open_scanner:'اسکنر', open_bot:'ربات تلگرام',
 recent:'سفارش‌های اخیر', recent_sub:'آخرین فعالیت فروش', view_all:'مشاهده همه',
 new_user:'کاربر جدید', search_ph:'جستجوی کاربر…',
 st_active:'فعال', st_expired:'منقضی', st_disabled:'غیرفعال',
 days_left:' روز باقی‌مانده', expired:'منقضی شده',
 qr_title:'کد QR اشتراک', qr_hint:'با v2rayNG ،Nekobox یا Streisand اسکن کنید',
 manage:'مدیریت', copied:'کپی شد ✓',
 m_manage:'مدیریت کاربر', m_link:'لینک اشتراک', m_formats:'فرمت‌های اشتراک', m_accs:'کانفیگ‌های پروکسی', m_limits:'محدودیت و انقضا',
 f_traffic:'حجم مجاز (گیگابایت)', f_days:'مدت (روز)', save:'ذخیره',
 m_new:'کاربر جدید', f_name:'نام و نام خانوادگی', f_user:'نام کاربری', create:'ساخت کاربر', created:'کاربر ساخته شد ✓',
 nodes_sum:'خلاصه وضعیت', online:'آنلاین', offline:'آفلاین',
 latency:'تأخیر', cert:'گواهی TLS', cert_days:' روز مانده', last_check:'آخرین بررسی', mins_ago:' دقیقه پیش',
 recheck:'بررسی مجدد', recheck_ok:'نود سالم است ✓', workers:'ورکرهای کلادفلر',
 scan_target:'هدف اسکن (دامنه یا IP)', scan_port:'پورت', scan_start:'شروع اسکن', scan_run:'در حال اسکن…',
 r_tcp:'اتصال TCP', tcp_ok:'برقرار شد', r_tls:'امنیت TLS', r_sni:'شناسایی SNI', r_http:'پاسخ HTTP',
 issuer:'صادرکننده', expires:'انقضا', sans:'دامنه‌های گواهی', status_code:'کد وضعیت',
 copy_report:'کپی گزارش کامل', report:'گزارش متنی',
 per_month:' ماهانه', vol:'حجم', dur:'مدت', edit:'ویرایش', popular:'پرفروش‌ترین',
 buy_note:'خریداران از طریق ربات تلگرام پرداخت می‌کنند و رسید را آپلود می‌کنند.',
 f1:'نصب روی ۲ دستگاه', f2:'پشتیبانی در تلگرام', f3:'سرورهای اروپا',
 f4:'نصب روی ۵ دستگاه', f5:'تمام لوکیشن‌ها', f6:'اولویت پشتیبانی',
 f7:'دستگاه نامحدود', f8:'IP اختصاصی', f9:'پشتیبانی ۲۴/۷',
 f_all:'همه', f_pending:'در انتظار', f_approved:'تأیید شده', f_rejected:'رد شده',
 proof:'رسید پرداخت', proof_sub:'از تلگرام آپلود شده', approve:'تأیید', reject:'رد',
 approved_toast:'تأیید شد — کاربر و اشتراک خودکار ساخته شد ✓', rejected_toast:'رد شد — به خریدار اطلاع داده شد',
 orders_note:'پس از تأیید، کاربر و اشتراک به‌صورت خودکار ساخته شده و لینک برای خریدار در تلگرام ارسال می‌شود.',
 buyer:'خریدار', amount:'مبلغ',
 set_lang:'زبان پنل', set_lang_sub:'می‌توانید هر لحظه بین فارسی و English جابه‌جا شوید',
 set_appear:'ظاهر', light:'روشن', dark:'تاریک',
 set_panel:'پنل', panel_name:'نام پنل', pub_url:'آدرس عمومی پنل',
 new_pass:'رمز جدید', new_pass2:'تکرار رمز جدید',
 set_tg:'ربات تلگرام', bot_token:'توکن ربات', admin_ids:'آی‌دی چت مدیران', channel:'آی‌دی کانال فروش', run_mode:'حالت اجرا',
 set_data:'داده و پشتیبان‌گیری', db_path:'مسیر دیتابیس', download_db:'دانلود بکاپ دیتابیس',
 saved:'ذخیره شد ✓', admin:'مدیر', full:'دسترسی کامل',
 k_secure:'امن', k_match:'تطابق دارد', k_http_ok:'موفق',
 edit_soon:'ویرایش در پنل اصلی انجام می‌شود', days_short:' روزه',
},
en:{
 dir:'ltr',
 nav_main:'Menu', nav_ops:'Operations',
 dashboard:'Dashboard', users:'Users', nodes:'Nodes & Workers', scanner:'Scanner',
 plans:'Plans', orders:'Orders', settings:'Settings', logout:'Sign out',
 sub_dashboard:"Today's network at a glance", sub_users:'Subscribers & subscriptions', sub_nodes:'Server & worker health',
 sub_scanner:'IP, port & SNI scanning', sub_plans:'Telegram bot sale plans', sub_orders:'Sales via the Telegram bot',
 sub_settings:'Panel configuration',
 auth_title:'Sign in to panel', auth_sub:'Enter the admin password to continue', auth_pw:'Admin password',
 auth_btn:'Sign in', auth_hint:'Default password:', auth_tag:'Users, subscriptions & nodes — professionally managed in one simple panel',
 feat1:'Auto-generated configs, subscriptions & QR', feat2:'Automated Telegram sales with payment proofs', feat3:'Node monitoring, telemetry & scanner',
 hello:'Hello, sir 👋', hello_sub:"Your network is healthy today — here's the summary:", today:'Today, Nov 9, 2026', welcome:'Welcome back, sir 👋',
 st_users:'Active users', st_users_sub:'1 expired · 1 disabled', st_rev:'Revenue this month', st_rev_sub:'12 sales via Telegram',
 st_nodes:'Nodes online', st_nodes_sub:'avg latency 31 ms', st_ord:'Pending orders', st_ord_sub:'waiting for your review',
 traffic:'Traffic — last 7 days', traffic_sub:'Across all users', lg_down:'Down', lg_up:'Up', gb:'GB',
 panel_url:'Panel URL', panel_url_sub:'Base for subscription links & QR — keeps working after you change domain',
 open_scanner:'Scanner', open_bot:'Telegram bot',
 recent:'Recent orders', recent_sub:'Latest sales activity', view_all:'View all',
 new_user:'New user', search_ph:'Search users…',
 st_active:'Active', st_expired:'Expired', st_disabled:'Disabled',
 days_left:' days left', expired:'Expired',
 qr_title:'Subscription QR', qr_hint:'Scan with v2rayNG, Nekobox or Streisand',
 manage:'Manage', copied:'Copied ✓',
 m_manage:'Manage user', m_link:'Subscription link', m_formats:'Subscription formats', m_accs:'Proxy accounts', m_limits:'Limits & expiry',
 f_traffic:'Traffic limit (GB)', f_days:'Duration (days)', save:'Save',
 m_new:'New user', f_name:'Full name', f_user:'Username', create:'Create user', created:'User created ✓',
 nodes_sum:'Overview', online:'Online', offline:'Offline',
 latency:'Latency', cert:'TLS certificate', cert_days:' days left', last_check:'Last check', mins_ago:' min ago',
 recheck:'Re-check', recheck_ok:'Node is healthy ✓', workers:'Cloudflare workers',
 scan_target:'Scan target (domain or IP)', scan_port:'Port', scan_start:'Start scan', scan_run:'Scanning…',
 r_tcp:'TCP connection', tcp_ok:'Established', r_tls:'TLS security', r_sni:'SNI (server name)', r_http:'HTTP probe',
 issuer:'Issuer', expires:'Expires', sans:'SANs', status_code:'Status code',
 copy_report:'Copy full report', report:'Text report',
 per_month:' / month', vol:'Traffic', dur:'Duration', edit:'Edit', popular:'Most popular',
 buy_note:'Buyers pay through the Telegram bot and upload a payment proof.',
 f1:'2 devices', f2:'Telegram support', f3:'EU servers',
 f4:'5 devices', f5:'All locations', f6:'Priority support',
 f7:'Unlimited devices', f8:'Dedicated IP', f9:'24/7 support',
 f_all:'All', f_pending:'Pending', f_approved:'Approved', f_rejected:'Rejected',
 proof:'Payment proof', proof_sub:'Uploaded from Telegram', approve:'Approve', reject:'Reject',
 approved_toast:'Approved — client & subscription created automatically ✓', rejected_toast:'Rejected — buyer has been notified',
 orders_note:'On approval, the client & subscription are created automatically and the link is sent to the buyer on Telegram.',
 buyer:'Buyer', amount:'Amount',
 set_lang:'Panel language', set_lang_sub:'Switch between Persian and English anytime',
 set_appear:'Appearance', light:'Light', dark:'Dark',
 set_panel:'Panel', panel_name:'Panel name', pub_url:'Public panel URL',
 new_pass:'New password', new_pass2:'Repeat new password',
 set_tg:'Telegram bot', bot_token:'Bot token', admin_ids:'Admin chat IDs', channel:'Sales channel ID', run_mode:'Run mode',
 set_data:'Data & backup', db_path:'Database file', download_db:'Download database backup',
 saved:'Saved ✓', admin:'Admin', full:'Full access',
 k_secure:'Secure', k_match:'Matched', k_http_ok:'OK',
 edit_soon:'Edit it in the real panel', days_short:' days',
}};

/* ================= icons ================= */
var SW='fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
var I={
dash:'<svg viewBox="0 0 24 24" '+SW+'><rect x="3" y="3" width="7.5" height="9.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="2"/></svg>',
users:'<svg viewBox="0 0 24 24" '+SW+'><circle cx="9" cy="8" r="3.6"/><path d="M2.8 20c.9-3.4 3.3-5.2 6.2-5.2s5.3 1.8 6.2 5.2"/><circle cx="17" cy="9" r="2.6"/><path d="M15.8 14.9c2.6.4 4.6 1.9 5.4 4.6"/></svg>',
server:'<svg viewBox="0 0 24 24" '+SW+'><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
scan:'<svg viewBox="0 0 24 24" '+SW+'><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4"/></svg>',
tag:'<svg viewBox="0 0 24 24" '+SW+'><path d="M20.6 13.3l-7.3 7.3a1.9 1.9 0 0 1-2.7 0L3 13V3h10l7.6 7.6a1.9 1.9 0 0 1 0 2.7z"/><circle cx="7.5" cy="7.5" r="1.3"/></svg>',
cart:'<svg viewBox="0 0 24 24" '+SW+'><circle cx="9" cy="20" r="1.6"/><circle cx="17.5" cy="20" r="1.6"/><path d="M2.5 3.5h2.4l2.5 11.2a1.8 1.8 0 0 0 1.8 1.4h7.9a1.8 1.8 0 0 0 1.8-1.4L21 7H6"/></svg>',
gear:'<svg viewBox="0 0 24 24" '+SW+'><path d="M4 6h8M17.5 6H20M4 12h3M11.5 12H20M4 18h10M18.5 18H20"/><circle cx="14.5" cy="6" r="2.1"/><circle cx="9" cy="12" r="2.1"/><circle cx="16.5" cy="18" r="2.1"/></svg>',
globe:'<svg viewBox="0 0 24 24" '+SW+'><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.3 4 5.2 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.2-4-8.5s1.4-6.2 4-8.5z"/></svg>',
sun:'<svg viewBox="0 0 24 24" '+SW+'><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5 5l1.6 1.6M17.4 17.4L19 19M19 5l-1.6 1.6M6.6 17.4L5 19"/></svg>',
moon:'<svg viewBox="0 0 24 24" '+SW+'><path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/></svg>',
copy:'<svg viewBox="0 0 24 24" '+SW+'><rect x="9" y="9" width="12" height="12" rx="2.5"/><path d="M5 15h-.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V5"/></svg>',
check:'<svg viewBox="0 0 24 24" '+SW+'><path d="M4.5 12.5l5 5L19.5 7"/></svg>',
x:'<svg viewBox="0 0 24 24" '+SW+'><path d="M6 6l12 12M18 6L6 18"/></svg>',
menu:'<svg viewBox="0 0 24 24" '+SW+'><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
logout:'<svg viewBox="0 0 24 24" '+SW+'><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
shield:'<svg viewBox="0 0 24 24" '+SW+'><path d="M12 2.5l7.5 3v6c0 5-3.2 8.4-7.5 10-4.3-1.6-7.5-5-7.5-10v-6z"/><path d="M9 12l2 2 4-4"/></svg>',
zap:'<svg viewBox="0 0 24 24" '+SW+'><path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/></svg>',
clock:'<svg viewBox="0 0 24 24" '+SW+'><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
search:'<svg viewBox="0 0 24 24" '+SW+'><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/></svg>',
plus:'<svg viewBox="0 0 24 24" '+SW+'><path d="M12 5v14M5 12h14"/></svg>',
refresh:'<svg viewBox="0 0 24 24" '+SW+'><path d="M20 12a8 8 0 1 1-2.9-6.2L20 8.5"/><path d="M20 3.5v5h-5"/></svg>',
send:'<svg viewBox="0 0 24 24" '+SW+'><path d="M21.5 2.5L10.8 13.2M21.5 2.5L14.5 21.5l-3.7-8.3L2.5 9.5z"/></svg>',
qr:'<svg viewBox="0 0 24 24" '+SW+'><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3.5v3.5H14zM20.5 14v.01M14 20.5v.01M20.5 20.5v.01M17.5 20.5h.01M20.5 17.5h.01"/></svg>',
alert:'<svg viewBox="0 0 24 24" '+SW+'><path d="M12 3.5L2.5 20h19z"/><path d="M12 10v4.5M12 17.5v.01"/></svg>',
download:'<svg viewBox="0 0 24 24" '+SW+'><path d="M12 3.5v11M7.5 10L12 14.5 16.5 10M4 19.5h16"/></svg>',
lang:'<svg viewBox="0 0 24 24" '+SW+'><path d="M3.5 5.5h8M7.5 3.5v2M10 5.5c-1 4-3.5 7-6.5 9M5 8.5c1.5 3 4 5.5 7 6.8"/><path d="M12.5 20.5l4.5-10 4.5 10M14.2 17h5.6"/></svg>',
};

/* ================= data ================= */
var D={
 users:[
  {id:1,name:'علی رضایی',user:'ali_reza',proto:'VLESS',used:12.4,limit:50,days:21,status:'active',token:'8Kj3mQ9pVx'},
  {id:2,name:'محمد کریمی',user:'mohammad_k',proto:'Trojan',used:47.1,limit:50,days:3,status:'active',token:'Ht2wRb7Yc'},
  {id:3,name:'سارا احمدی',user:'sara_a',proto:'VMess',used:2.1,limit:10,days:28,status:'active',token:'Pn5sKd1We'},
  {id:4,name:'Reza_M',user:'reza_m',proto:'VLESS',used:31.6,limit:50,days:9,status:'active',token:'Qw8fGz4Rt'},
  {id:5,name:'نوید شریفی',user:'navid',proto:'Shadowsocks',used:10,limit:10,days:0,status:'expired',token:'Yc6vBn2Mk'},
  {id:6,name:'آرش مرادی',user:'arash',proto:'VLESS',used:0,limit:20,days:0,status:'disabled',token:'Ui3oPa9Ld'},
 ],
 nodes:[
  {name:'Frankfurt-1',host:'5.9.114.72:443',ms:19,cert:68,check:2,status:'online'},
  {name:'Tehran-1',host:'91.98.44.12:8443',ms:43,cert:12,check:2,status:'online'},
  {name:'Stockholm-1',host:'45.131.7.240:443',ms:null,cert:null,check:34,status:'offline'},
 ],
 workers:[
  {name:'bashar-tehran.workers.dev',ms:86,status:'online'},
  {name:'bashar-eu.workers.dev',ms:112,status:'online'},
 ],
 orders:[
  {id:'ORD-1024',user:'@ali_2000',plan:'standard',status:'pending',time:{fa:'۱۲ دقیقه پیش',en:'12 min ago'}},
  {id:'ORD-1023',user:'@mehdi_h',plan:'pro',status:'approved',time:{fa:'۲ ساعت پیش',en:'2 hours ago'}},
  {id:'ORD-1022',user:'@sara76',plan:'starter',status:'rejected',time:{fa:'دیروز',en:'yesterday'}},
 ],
 plans:[
  {key:'starter',price:{fa:'۹۸٬۰۰۰ تومان',en:'$2'},vol:'50GB',days:30,feats:['f1','f2','f3']},
  {key:'standard',price:{fa:'۱۹۸٬۰۰۰ تومان',en:'$4'},vol:'150GB',days:30,feats:['f4','f5','f6'],pop:true},
  {key:'pro',price:{fa:'۴۹۸٬۰۰۰ تومان',en:'$8'},vol:'500GB',days:90,feats:['f7','f8','f9']},
 ],
 planNames:{starter:{fa:'استارتر',en:'Starter'},standard:{fa:'استاندارد',en:'Standard'},pro:{fa:'پرو',en:'Pro'}},
};
var PANEL_URL='https://panel.bashar-host.ir';
var AVA=['linear-gradient(135deg,#10B981,#0D9488)','linear-gradient(135deg,#0EA5E9,#6366F1)','linear-gradient(135deg,#F59E0B,#EF4444)','linear-gradient(135deg,#8B5CF6,#D946EF)','linear-gradient(135deg,#14B8A6,#0EA5E9)','linear-gradient(135deg,#64748B,#334155)'];
var QR_SVG={{QR_SVG}};

/* ================= state & helpers ================= */
var LANG='fa', DARK=false, VIEW='dashboard', LOGGED=false, UFILTER='', OFILTER='all', NEXT_ID=7;
function t(k){return (I18N[LANG]&&I18N[LANG][k])||I18N.fa[k]||k}
function store(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
var FAD='۰۱۲۳۴۵۶۷۸۹';
function nf(v){var s=String(v);if(LANG==='fa'){s=s.replace(/\d/g,function(d){return FAD[d]}).replace('.','٫')}return s}
function $(id){return document.getElementById(id)}
function subLink(u){return PANEL_URL+'/sub/'+u.token}

function toast(msg){var el=document.createElement('div');el.className='toast';el.innerHTML=I.check+'<span>'+msg+'</span>';
 $('toasts').appendChild(el);setTimeout(function(){el.style.transition='opacity .3s';el.style.opacity='0';setTimeout(function(){el.remove()},320)},2400)}
function copyText(txt){
 var ok=function(){toast(t('copied'))};
 var fallback=function(){var ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';ta.style.opacity='0';
   document.body.appendChild(ta);ta.select();try{document.execCommand('copy');ok()}catch(e){}ta.remove()};
 if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(txt).then(ok,fallback)}else{fallback()}
}
function openModal(html){$('modal-root').innerHTML='<div class="overlay" onclick="if(event.target===this)closeModal()"><div class="modal">'+html+'</div></div>'}
function closeModal(){$('modal-root').innerHTML=''}
function statusBadge(s){
 if(s==='active')return '<span class="badge bd-green"><span class="dot dt-green"></span>'+t('st_active')+'</span>';
 if(s==='expired')return '<span class="badge bd-rose">'+t('st_expired')+'</span>';
 return '<span class="badge bd-gray">'+t('st_disabled')+'</span>';
}
function orderBadge(s){
 if(s==='pending')return '<span class="badge bd-amber"><span class="dot dt-amber"></span>'+t('f_pending')+'</span>';
 if(s==='approved')return '<span class="badge bd-green"><span class="dot dt-green"></span>'+t('f_approved')+'</span>';
 return '<span class="badge bd-rose">'+t('f_rejected')+'</span>';
}

/* ================= theme & language ================= */
function applyHtml(){
 document.documentElement.lang=LANG;
 document.documentElement.dir=I18N[LANG].dir;
 document.documentElement.classList.toggle('dark',DARK);
}
function toggleLang(){LANG=LANG==='fa'?'en':'fa';store('bp_lang',LANG);applyHtml();LOGGED?renderApp():renderLogin()}
function toggleDark(){DARK=!DARK;store('bp_dark',DARK?'1':'0');applyHtml();LOGGED?renderApp():renderLogin()}

/* ================= login ================= */
function renderLogin(){
 $('root').innerHTML=
 '<div class="auth">'+
  '<div class="auth-brand">'+
   '<div class="auth-logo">ب</div>'+
   '<h1>پنل بشار</h1>'+
   '<p class="tag">'+t('auth_tag')+'</p>'+
   '<div class="feat"><div class="icon-tile">'+I.shield+'</div><span>'+t('feat1')+'</span></div>'+
   '<div class="feat"><div class="icon-tile">'+I.send+'</div><span>'+t('feat2')+'</span></div>'+
   '<div class="feat"><div class="icon-tile">'+I.scan+'</div><span>'+t('feat3')+'</span></div>'+
   '<div class="auth-ver">Bashar Panel · v2.0 · فارسی / English</div>'+
  '</div>'+
  '<div class="auth-form">'+
   '<div class="auth-tools">'+
    '<button class="lang-pill" onclick="toggleLang()">'+I.lang+'<span>'+(LANG==='fa'?'English':'فارسی')+'</span></button>'+
    '<button class="icon-btn" onclick="toggleDark()">'+(DARK?I.sun:I.moon)+'</button>'+
   '</div>'+
   '<div class="auth-card fade-in">'+
    '<div class="logo">ب</div>'+
    '<h2>'+t('auth_title')+'</h2>'+
    '<p class="sub">'+t('auth_sub')+'</p>'+
    '<div class="field"><label>'+t('auth_pw')+'</label>'+
     '<input id="pw" class="input" type="password" value="admin123" onkeydown="if(event.key===\'Enter\')doLogin()"></div>'+
    '<button class="btn btn-primary" style="width:100%;margin-top:14px;height:43px" onclick="doLogin()">'+I.shield+t('auth_btn')+'</button>'+
    '<div class="hint">'+t('auth_hint')+' <code>admin123</code></div>'+
   '</div>'+
  '</div>'+
 '</div>';
}
function doLogin(){LOGGED=true;VIEW='dashboard';renderApp();toast(t('welcome'))}

/* ================= app shell ================= */
function navItems(){
 var items=[['dashboard',I.dash],['users',I.users],['nodes',I.server]];
 var ops=[['scanner',I.scan],['plans',I.tag],['orders',I.cart],['settings',I.gear]];
 var h='<div class="nav-label">'+t('nav_main')+'</div>';
 items.forEach(function(it){h+=navBtn(it[0],it[1])});
 h+='<div class="nav-label">'+t('nav_ops')+'</div>';
 ops.forEach(function(it){h+=navBtn(it[0],it[1])});
 return h;
}
function navBtn(v,icon){
 var pending=D.orders.filter(function(o){return o.status==='pending'}).length;
 var badge=(v==='orders'&&pending)?'<span class="nav-badge">'+nf(pending)+'</span>':'';
 return '<button class="nav-item'+(VIEW===v?' active':'')+'" onclick="nav(\''+v+'\')">'+icon+'<span>'+t(v)+'</span>'+badge+'</button>';
}
function renderApp(){
 var pending=D.orders.filter(function(o){return o.status==='pending'}).length;
 $('root').innerHTML=
 '<div class="app">'+
  '<aside class="sidebar" id="sidebar">'+
   '<div class="side-brand"><div class="logo">ب</div><div><b>پنل بشار</b><span>Bashar Panel</span></div></div>'+
   '<nav class="side-nav">'+navItems()+'</nav>'+
   '<div class="side-foot">'+
    '<div class="side-user"><div class="avatar">B</div><div><b>'+t('admin')+'</b><span>'+t('full')+'</span></div>'+
     '<div class="spacer"></div><span class="dot dt-green"></span></div>'+
    '<button class="nav-item" onclick="doLogout()" style="color:var(--side-text)">'+I.logout+'<span>'+t('logout')+'</span></button>'+
   '</div>'+
  '</aside>'+
  '<div class="main">'+
   '<div class="topbar">'+
    '<button class="icon-btn menu-btn" onclick="openSide()">'+I.menu+'</button>'+
    '<div><h1>'+t(VIEW)+'</h1><div class="sub">'+t('sub_'+VIEW)+'</div></div>'+
    '<div class="spacer"></div>'+
    '<button class="lang-pill" onclick="toggleLang()">'+I.lang+'<span>'+(LANG==='fa'?'English':'فارسی')+'</span></button>'+
    '<button class="icon-btn" onclick="toggleDark()">'+(DARK?I.sun:I.moon)+'</button>'+
    '<div class="avatar top-avatar">B</div>'+
   '</div>'+
   '<div class="content"><div id="view"></div></div>'+
  '</div>'+
 '</div>';
 renderView();
}
function renderView(){
 var v={dashboard:vDash,users:vUsers,nodes:vNodes,scanner:vScan,plans:vPlans,orders:vOrders,settings:vSet}[VIEW];
 $('view').innerHTML='<div class="fade-in">'+v()+'</div>';
 if(VIEW==='users')renderUList();
}
function nav(v){VIEW=v;UFILTER='';closeSide();renderApp()}
function doLogout(){LOGGED=false;renderLogin()}
function openSide(){$('sidebar').classList.add('open');var b=document.createElement('div');b.id='backdrop';b.setAttribute('onclick','closeSide()');document.body.appendChild(b)}
function closeSide(){var s=$('sidebar');if(s)s.classList.remove('open');var b=$('backdrop');if(b)b.remove()}
