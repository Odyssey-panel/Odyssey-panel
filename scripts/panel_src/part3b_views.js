
/* ================= views ================= */
function chartSVG(){
 var down=[2.4,3.8,3.1,4.6,5.2,4.1,5.8], up=[1.1,1.6,1.4,2.2,2.6,1.9,2.7];
 var max=6.5,W=560,H=200,x0=42,x1=548,y0=170;
 function pts(a){return a.map(function(v,i){return [x0+i*(x1-x0)/6, y0-(v/max)*130]})}
 var pd=pts(down),pu=pts(up);
 function line(p){return p.map(function(q,i){return (i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)}).join(' ')}
 var area=line(pd)+' L'+x1+' '+y0+' L'+x0+' '+y0+' Z';
 var days=LANG==='fa'?['ش','ی','د','س','چ','پ','ج']:['Sat','Sun','Mon','Tue','Wed','Thu','Fri'];
 var grid=[0,2,4,6].map(function(v){var y=y0-(v/max)*130;
  return '<line x1="'+x0+'" y1="'+y+'" x2="'+x1+'" y2="'+y+'" style="stroke:var(--border)" stroke-dasharray="3 4"/>'+
  '<text x="'+(x0-8)+'" y="'+(y+3.5)+'" text-anchor="end" font-size="10" style="fill:var(--text3)">'+nf(v)+'</text>'}).join('');
 var labels=days.map(function(d,i){return '<text x="'+(x0+i*(x1-x0)/6)+'" y="192" text-anchor="middle" font-size="10.5" style="fill:var(--text3)">'+d+'</text>'}).join('');
 var dots=pd.map(function(q){return '<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="3.4" style="fill:var(--card);stroke:#10B981" stroke-width="2.2"/>'}).join('');
 return '<svg viewBox="0 0 560 200" style="width:100%;height:auto">'+
 '<defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">'+
 '<stop offset="0" style="stop-color:var(--brand);stop-opacity:.28"/><stop offset="1" style="stop-color:var(--brand);stop-opacity:0"/></linearGradient></defs>'+
 grid+'<path d="'+area+'" fill="url(#ga)"/>'+
 '<path d="'+line(pu)+'" fill="none" style="stroke:var(--sky)" stroke-width="2.2" stroke-dasharray="5 5" stroke-linecap="round"/>'+
 '<path d="'+line(pd)+'" fill="none" style="stroke:var(--brand)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>'+
 dots+labels+'</svg>';
}
function vDash(){
 var act=D.users.filter(function(u){return u.status==='active'}).length;
 var pend=D.orders.filter(function(o){return o.status==='pending'}).length;
 var rev=LANG==='fa'?'۴۸۲٬۰۰۰':'$96';
 var stats=[
  [act,t('st_users'),t('st_users_sub'),I.users,'tile-brand'],
  [rev,t('st_rev'),t('st_rev_sub'),I.cart,'tile-sky'],
  [2,t('st_nodes'),t('st_nodes_sub'),I.server,'tile-violet'],
  [pend,t('st_ord'),t('st_ord_sub'),I.alert,'tile-amber']
 ].map(function(s){return '<div class="stat"><div class="lbl">'+s[1]+'</div><div class="val num">'+nf(s[0])+'</div><div class="delta">'+s[2]+'</div><div class="icon-tile '+s[4]+'">'+s[3]+'</div></div>'}).join('');
 return '<div class="page-head" style="margin-bottom:16px">'+
   '<div><h1>'+t('hello')+'</h1><div class="muted tiny">'+t('hello_sub')+'</div></div>'+
   '<div class="spacer"></div><span class="badge bd-gray">'+I.clock+t('today')+'</span></div>'+
  '<div class="stats">'+stats+'</div>'+
  '<div class="split-3-2">'+
   '<div class="card"><div class="card-head">'+I.zap+'<div style="flex:1"><h3>'+t('traffic')+'</h3><div class="hint">'+t('traffic_sub')+'</div></div>'+
    '<div class="legend"><span><i style="background:#10B981"></i>'+t('lg_down')+'</span><span><i style="background:var(--sky)"></i>'+t('lg_up')+'</span></div></div>'+
    '<div class="chart-wrap">'+chartSVG()+'</div></div>'+
   '<div class="card"><div class="card-head">'+I.globe+'<div style="flex:1"><h3>'+t('panel_url')+'</h3><div class="hint">'+t('panel_url_sub')+'</div></div></div>'+
    '<div class="card-pad">'+
     '<div class="u-link" style="margin:0 0 14px"><code style="font-size:12px">'+PANEL_URL+'</code><button class="mini-btn" onclick="copyText(\''+PANEL_URL+'\')">'+I.copy+'</button></div>'+
     '<div style="display:flex;gap:9px;flex-wrap:wrap">'+
      '<button class="btn btn-soft btn-sm" onclick="nav(\'scanner\')">'+I.scan+'<span>'+t('open_scanner')+'</span></button>'+
      '<button class="btn btn-ghost btn-sm" onclick="nav(\'settings\')">'+I.send+'<span>'+t('open_bot')+'</span></button>'+
     '</div></div></div>'+
  '</div>'+
  '<div class="card mt"><div class="card-head">'+I.cart+'<div style="flex:1"><h3>'+t('recent')+'</h3><div class="hint">'+t('recent_sub')+'</div></div>'+
   '<button class="btn btn-ghost btn-sm" onclick="nav(\'orders\')">'+t('view_all')+'</button></div>'+
   '<div class="rows">'+D.orders.slice(0,3).map(orderRow).join('')+'</div></div>';
}

/* ---------- users ---------- */
function vUsers(){
 return '<div class="page-head"><h2>'+t('users')+'</h2><span class="badge bd-gray">'+nf(D.users.length)+'</span>'+
  '<div class="grow"></div>'+
  '<div class="search">'+I.search+'<input class="input" placeholder="'+t('search_ph')+'" value="'+UFILTER+'" oninput="UFILTER=this.value;renderUList()"></div>'+
  '<button class="btn btn-primary" onclick="openNewUser()">'+I.plus+'<span>'+t('new_user')+'</span></button></div>'+
  '<div id="uList" class="grid-2 stagger"></div>';
}
function renderUList(){
 var list=D.users.filter(function(u){return !UFILTER||u.name.indexOf(UFILTER)>-1||u.user.indexOf(UFILTER)>-1});
 $('uList').innerHTML=list.length?list.map(userCard).join(''):'<div class="card empty" style="grid-column:1/-1">'+t('search_ph')+'</div>';
}
function userCard(u){
 var pct=Math.min(100,Math.round(u.used/u.limit*100))||0;
 var qcls=pct>=95?'q-full':pct>=75?'q-warn':'';
 var link=subLink(u);
 var exp=u.status==='expired'?'<span class="badge bd-rose">'+I.clock+t('expired')+'</span>'
  :'<span class="badge bd-gray">'+I.clock+nf(u.days)+t('days_left')+'</span>';
 return '<div class="u-card">'+
  '<div class="u-top"><div class="u-ava" style="background:'+AVA[u.id%AVA.length]+'">'+u.name.charAt(0)+'</div>'+
   '<div style="flex:1;min-width:0"><b>'+u.name+'</b><span class="usr mono">@'+u.user+' · '+u.proto+'</span></div>'+
   statusBadge(u.status)+'</div>'+
  '<div class="u-link"><code>'+link+'</code>'+
   '<button class="mini-btn" onclick="copyText(\''+link+'\')">'+I.copy+'</button>'+
   '<button class="mini-btn" onclick="openQr('+u.id+')">'+I.qr+'</button></div>'+
  '<div class="u-quota"><div class="q-lbl"><span>'+nf(u.used)+' / '+nf(u.limit)+' '+t('gb')+'</span><span class="num">'+nf(pct)+(LANG==='fa'?'٪':'%')+'</span></div>'+
   '<div class="quota '+qcls+'"><i style="width:'+pct+'%"></i></div></div>'+
  '<div class="u-foot">'+exp+'<div class="grow"></div>'+
   '<button class="btn btn-ghost btn-sm" onclick="openManage('+u.id+')">'+I.gear+'<span>'+t('manage')+'</span></button></div></div>';
}
function openQr(id){
 var u=D.users.find(function(x){return x.id===id}),link=subLink(u);
 openModal('<div class="modal-h"><div class="icon-tile tile-brand">'+I.qr+'</div><h3 style="flex:1">'+t('qr_title')+' — '+u.name+'</h3>'+
  '<button class="icon-btn" onclick="closeModal()">'+I.x+'</button></div>'+
  '<div class="modal-b" style="text-align:center">'+
  '<div class="qr-box" style="background:#fff;padding:12px;border-radius:16px;display:inline-block;border:1px solid var(--border)">'+QR_SVG+'</div>'+
  '<div class="u-link" style="margin-top:14px;text-align:start"><code>'+link+'</code>'+
  '<button class="mini-btn" onclick="copyText(\''+link+'\')">'+I.copy+'</button></div>'+
  '<div class="tiny muted" style="margin-top:8px">'+t('qr_hint')+'</div></div>');
}
function accs(u){
 var host='de1.bashar-host.ir';
 return [
  {p:'vless',s:'vless://e3a1b27c-4f6e-4d9a-9b8c-'+u.token.toLowerCase()+'@'+host+':443?encryption=none&security=tls&sni=cdn.bashar-host.ir&type=ws#Bashar-1'},
  {p:'trojan',s:'trojan://pw_'+u.token.toLowerCase()+'@'+host+':443?security=tls&sni='+host+'#Bashar-2'},
  {p:'ss',s:'ss://YWVzLTI1Ni1nY206'+u.token+'@'+host+':8388#Bashar-3'}];
}
var FMT={
 base64:'dmxlc3M6Ly9lM2ExYjI3Yy00ZjZlLTRkOWEtOWI4Yy04S2ozbVE5cFZ4QGRlMS5iYXNoYXItaG9zdC5pcjo0NDM=',
 clash:'port: 7890\nproxies:\n  - name: "Bashar-1"\n    type: vless\n    server: de1.bashar-host.ir\n    port: 443\n    tls: true',
 singbox:'{"outbounds":[{"type":"vless","server":"de1.bashar-host.ir","server_port":443,"tls":{"enabled":true}}]}'};
function copyFmt(k){copyText(FMT[k])}
function openManage(id){
 var u=D.users.find(function(x){return x.id===id}),link=subLink(u);
 openModal('<div class="modal-h"><div class="icon-tile tile-brand">'+I.users+'</div><h3 style="flex:1">'+t('m_manage')+' — '+u.name+'</h3>'+
  '<button class="icon-btn" onclick="closeModal()">'+I.x+'</button></div><div class="modal-b">'+
  '<div class="tiny" style="font-weight:700;margin-bottom:8px">'+t('m_link')+'</div>'+
  '<div class="u-link" style="margin:0"><code>'+link+'</code>'+
   '<button class="mini-btn" onclick="copyText(\''+link+'\')">'+I.copy+'</button>'+
   '<button class="mini-btn" onclick="openQr('+u.id+')">'+I.qr+'</button></div>'+
  '<div class="tiny" style="font-weight:700;margin:16px 0 8px">'+t('m_formats')+'</div>'+
  '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
   '<button class="chip" onclick="copyFmt(\'base64\')">'+I.copy+'Base64</button>'+
   '<button class="chip" onclick="copyFmt(\'clash\')">'+I.copy+'Clash</button>'+
   '<button class="chip" onclick="copyFmt(\'singbox\')">'+I.copy+'sing-box</button></div>'+
  '<div class="tiny" style="font-weight:700;margin:16px 0 4px">'+t('m_accs')+'</div>'+
  accs(u).map(function(a){return '<div class="kv"><span class="k"><span class="badge bd-sky">'+a.p+'</span></span>'+
   '<span class="v mono" style="font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:ltr;text-align:end">'+a.s+'</span>'+
   '<button class="mini-btn" onclick="copyText(\''+a.s+'\')">'+I.copy+'</button></div>'}).join('')+
  '<div class="tiny" style="font-weight:700;margin:16px 0 8px">'+t('m_limits')+'</div>'+
  '<div class="grid-2"><div class="field"><label>'+t('f_traffic')+'</label><input id="limGb" class="input num" value="'+u.limit+'"></div>'+
   '<div class="field"><label>'+t('f_days')+'</label><input id="limDays" class="input num" value="'+u.days+'"></div></div>'+
  '<button class="btn btn-primary" style="width:100%;margin-top:15px" onclick="saveLimits('+u.id+')">'+I.check+t('save')+'</button>'+
  '</div>');
}
function saveLimits(id){
 var u=D.users.find(function(x){return x.id===id});
 u.limit=parseFloat($('limGb').value)||u.limit;u.days=parseInt($('limDays').value)||0;
 closeModal();renderView();toast(t('saved'));
}
function openNewUser(){
 openModal('<div class="modal-h"><div class="icon-tile tile-brand">'+I.users+'</div><h3 style="flex:1">'+t('m_new')+'</h3>'+
  '<button class="icon-btn" onclick="closeModal()">'+I.x+'</button></div><div class="modal-b">'+
  '<div class="field" style="margin-bottom:12px"><label>'+t('f_name')+'</label><input id="nuName" class="input" placeholder="'+t('f_name')+'"></div>'+
  '<div class="field" style="margin-bottom:12px"><label>'+t('f_user')+'</label><input id="nuUser" class="input mono" placeholder="username"></div>'+
  '<div class="grid-2"><div class="field"><label>'+t('f_traffic')+'</label><select id="nuGb" class="input"><option>10</option><option selected>50</option><option>100</option></select></div>'+
   '<div class="field"><label>'+t('f_days')+'</label><select id="nuDays" class="input"><option selected>30</option><option>90</option></select></div></div>'+
  '<button class="btn btn-primary" style="width:100%;margin-top:15px" onclick="createUser()">'+I.plus+t('create')+'</button></div>');
}
function createUser(){
 var name=$('nuName').value.trim()||'User',usr=$('nuUser').value.trim().replace(/\s+/g,'_').toLowerCase()||'user'+NEXT_ID;
 D.users.unshift({id:NEXT_ID++,name:name,user:usr,proto:'VLESS',used:0,limit:parseFloat($('nuGb').value),days:parseInt($('nuDays').value),status:'active',token:Math.random().toString(36).slice(2,12)});
 closeModal();renderView();toast(t('created'));
}

/* ---------- nodes ---------- */
function vNodes(){
 var on=D.nodes.filter(function(n){return n.status==='online'}).length,off=D.nodes.length-on;
 var sum='<div class="card card-pad" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:14px">'+
  '<span class="badge bd-green"><span class="dot dt-green"></span>'+nf(on)+' '+t('online')+'</span>'+
  '<span class="badge bd-rose"><span class="dot dt-rose"></span>'+nf(off)+' '+t('offline')+'</span>'+
  '<span class="badge bd-sky">'+I.zap+' 31 ms</span><div class="grow"></div>'+
  '<span class="tiny muted">'+t('nodes_sum')+'</span></div>';
 var cards='<div class="grid-2 stagger">'+D.nodes.map(nodeCard).join('')+'</div>';
 var wk='<div class="card mt"><div class="card-head">'+I.globe+'<h3 style="flex:1">'+t('workers')+'</h3></div><div class="rows">'+
  D.workers.map(function(w,i){return '<div class="row-item"><div class="icon-tile tile-sky">'+I.globe+'</div>'+
   '<div class="grow"><b style="font-size:13px" class="mono">'+w.name+'</b></div>'+
   '<span class="badge bd-gray">'+I.zap+nf(w.ms)+' ms</span>'+
   '<span class="badge bd-green"><span class="dot dt-green"></span>'+t('online')+'</span></div>'}).join('')+'</div></div>';
 return sum+cards+wk;
}
function nodeCard(n,i){
 var on=n.status==='online';
 return '<div class="u-card"><div class="u-top">'+
  '<div class="icon-tile '+(on?'tile-brand':'tile-rose')+'">'+I.server+'</div>'+
  '<div style="flex:1;min-width:0"><b>'+n.name+'</b><span class="usr mono">'+n.host+'</span></div>'+
  '<span class="badge '+(on?'bd-green':'bd-rose')+'"><span class="dot '+(on?'dt-green':'dt-rose')+'"></span>'+(on?t('online'):t('offline'))+'</span></div>'+
  '<div class="grid-3" style="gap:10px;margin-top:13px">'+
  '<div style="background:var(--card2);border:1px solid var(--border);border-radius:11px;padding:9px 12px"><div class="tiny muted">'+t('latency')+'</div><b class="num" style="font-size:14.5px">'+(n.ms!=null?nf(n.ms)+' ms':'—')+'</b></div>'+
  '<div style="background:var(--card2);border:1px solid var(--border);border-radius:11px;padding:9px 12px"><div class="tiny muted">'+t('cert')+'</div><b class="num" style="font-size:14.5px">'+(n.cert!=null?nf(n.cert)+t('cert_days'):'—')+'</b></div>'+
  '<div style="background:var(--card2);border:1px solid var(--border);border-radius:11px;padding:9px 12px"><div class="tiny muted">'+t('last_check')+'</div><b class="num" style="font-size:14.5px">'+nf(n.check)+t('mins_ago')+'</b></div></div>'+
  '<button class="btn btn-soft btn-sm mt" style="width:100%" onclick="recheckNode('+i+')">'+I.refresh+t('recheck')+'</button></div>';
}
function recheckNode(i){
 var n=D.nodes[i];n.ms=Math.floor(15+Math.random()*45);n.check=0;n.status='online';
 renderView();toast(t('recheck_ok'));
}

/* ---------- scanner ---------- */
var REPORT='Target  : cloudflare-dns.com:443\nTCP     : OPEN  (19 ms)\nTLS     : TLSv1.3  LE_R3 (expires 2027-01-29)\nSNI     : cloudflare-dns.com  [MATCH]\nHTTP    : 200 OK  (86 ms, server: cloudflare)';
function vScan(){
 return '<div class="card card-pad"><div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">'+
  '<div class="field" style="flex:1;min-width:210px"><label>'+t('scan_target')+'</label><input id="scanT" class="input mono" value="cloudflare-dns.com"></div>'+
  '<div class="field" style="width:110px"><label>'+t('scan_port')+'</label><input id="scanP" class="input mono" value="443"></div>'+
  '<button id="scanBtn" class="btn btn-primary" style="height:40px" onclick="doScan()">'+I.zap+'<span>'+t('scan_start')+'</span></button>'+
  '</div></div><div id="scanOut" class="mt"></div>';
}
function doScan(){
 var b=$('scanBtn');b.innerHTML='<span class="spin"></span><span>'+t('scan_run')+'</span>';b.style.opacity='.75';
 setTimeout(function(){b.innerHTML=I.zap+'<span>'+t('scan_start')+'</span>';b.style.opacity='1';renderScanOut()},900);
}
function resCard(tile,tileCls,title,badge,rows){
 return '<div class="card"><div class="card-head"><div class="icon-tile '+tileCls+'" style="width:32px;height:32px">'+tile+'</div>'+
  '<h3 style="flex:1">'+title+'</h3>'+badge+'</div><div class="card-pad" style="padding-top:8px">'+
  rows.map(function(r){return '<div class="kv"><span class="k">'+r[0]+'</span><span class="v mono" style="direction:ltr">'+r[1]+'</span></div>'}).join('')+'</div></div>';
}
function renderScanOut(){
 var ok='<span class="badge bd-green">'+I.check+'</span>';
 var cards=
  resCard(I.zap,'tile-brand',t('r_tcp'),'<span class="badge bd-green">'+I.check+t('tcp_ok')+'</span>',[['Host','cloudflare-dns.com'],['IP','104.16.44.133'],['Time','19 ms']])+
  resCard(I.shield,'tile-violet',t('r_tls'),'<span class="badge bd-green">'+I.check+t('k_secure')+'</span>',[['TLS','TLSv1.3'],[t('issuer'),"Let's Encrypt R3"],[t('expires'),'2027-01-29 (81 '+ (LANG==='fa'?'روز':'days')+')']])+
  resCard(I.scan,'tile-sky',t('r_sni'),'<span class="badge bd-green">'+I.check+t('k_match')+'</span>',[['SNI','cloudflare-dns.com'],[t('sans'),'*.cloudflare-dns.com +2']])+
  resCard(I.globe,'tile-amber',t('r_http'),'<span class="badge bd-green">'+I.check+t('k_http_ok')+'</span>',[[t('status_code'),'200 OK'],['Server','cloudflare'],['Time','86 ms']]);
 $('scanOut').innerHTML='<div class="grid-2 stagger">'+cards+'</div>'+
  '<div class="card mt"><div class="card-head">'+I.copy+'<h3 style="flex:1">'+t('report')+'</h3>'+
  '<button class="btn btn-soft btn-sm" onclick="copyText(REPORT)">'+I.copy+t('copy_report')+'</button></div>'+
  '<div class="card-pad"><pre class="mono" style="font-size:11px;white-space:pre-wrap;color:var(--text2);line-height:1.9">'+REPORT+'</pre></div></div>';
}

/* ---------- plans ---------- */
function vPlans(){
 return '<div class="grid-3 stagger">'+D.plans.map(function(p){
  return '<div class="u-card" style="position:relative'+(p.pop?';border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-ring),var(--sh-md)':'')+'">'+
   (p.pop?'<span class="badge bd-green" style="position:absolute;top:14px;inset-inline-end:14px">'+t('popular')+'</span>':'')+
   '<div class="icon-tile tile-brand">'+I.tag+'</div>'+
   '<h3 style="margin-top:12px;font-size:15.5px">'+D.planNames[p.key][LANG]+'</h3>'+
   '<div style="margin:3px 0 10px"><span style="font-size:22px;font-weight:800">'+p.price[LANG]+'</span><span class="tiny muted">'+t('per_month')+'</span></div>'+
   '<div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px">'+
    '<span class="badge bd-gray">'+I.zap+p.vol+'</span>'+
    '<span class="badge bd-gray">'+I.clock+nf(p.days)+t('days_short')+'</span></div>'+
   p.feats.map(function(f){return '<div style="display:flex;align-items:center;gap:9px;padding:4.5px 0;font-size:12.5px;color:var(--text2)">'+
    '<span class="icon-tile tile-brand" style="width:22px;height:22px;border-radius:7px">'+I.check+'</span>'+t(f)+'</div>'}).join('')+
   '<button class="btn '+(p.pop?'btn-primary':'btn-ghost')+' btn-sm" style="width:100%;margin-top:13px" onclick="toast(t(\'edit_soon\'))">'+I.gear+t('edit')+'</button></div>'}).join('')+'</div>'+
  '<div class="card mt" style="display:flex;gap:12px;align-items:center;padding:15px 18px">'+
   '<div class="icon-tile tile-brand">'+I.send+'</div><span class="tiny muted">'+t('buy_note')+'</span></div>';
}

/* ---------- orders ---------- */
function setOF(k){OFILTER=k;renderView()}
function decide(id,st){
 var o=D.orders.find(function(x){return x.id===id});o.status=st;
 renderView();toast(st==='approved'?t('approved_toast'):t('rejected_toast'));
}
function openProof(id){
 var o=D.orders.find(function(x){return x.id===id});
 openModal('<div class="modal-h"><div class="icon-tile tile-violet">'+I.alert+'</div><h3 style="flex:1">'+t('proof')+' — '+o.id+'</h3>'+
  '<button class="icon-btn" onclick="closeModal()">'+I.x+'</button></div>'+
  '<div class="modal-b" style="text-align:center">'+
  '<div style="border:2px dashed var(--border2);border-radius:16px;padding:38px 16px;background:var(--card2)">'+
  '<div class="icon-tile tile-violet" style="width:52px;height:52px;margin:0 auto 12px">'+I.alert+'</div>'+
  '<b style="display:block">'+o.user+'</b><span class="tiny muted">'+t('proof_sub')+'</span></div>'+
  '<button class="btn btn-primary" style="margin-top:14px" onclick="decide(\''+o.id+'\',\'approved\')">'+I.check+t('approve')+'</button></div>');
}
function orderRow(o){
 var p=D.plans.find(function(x){return x.key===o.plan});
 var acts=o.status==='pending'
  ?'<button class="btn btn-soft btn-sm" onclick="decide(\''+o.id+'\',\'approved\')">'+I.check+'<span>'+t('approve')+'</span></button>'+
   '<button class="btn btn-danger btn-sm" onclick="decide(\''+o.id+'\',\'rejected\')">'+I.x+'<span>'+t('reject')+'</span></button>'
  :'';
 return '<div class="row-item"><div class="icon-tile tile-violet">'+I.send+'</div>'+
  '<div class="grow"><b style="font-size:13px" class="mono">'+o.user+'</b>'+
  '<div class="tiny muted"><span class="mono">'+o.id+'</span> · '+D.planNames[o.plan][LANG]+' · '+o.time[LANG]+'</div></div>'+
  '<span class="badge bd-gray">'+p.price[LANG]+'</span>'+orderBadge(o.status)+
  '<div style="display:flex;gap:6px"><button class="mini-btn" onclick="openProof(\''+o.id+'\')" title="'+t('proof')+'">'+I.alert+'</button>'+acts+'</div></div>';
}
function vOrders(){
 var list=D.orders.filter(function(o){return OFILTER==='all'||o.status===OFILTER});
 var seg=['all','pending','approved','rejected'].map(function(k){
  return '<button class="'+(OFILTER===k?'on':'')+'" onclick="setOF(\''+k+'\')">'+t(k==='all'?'f_all':k==='pending'?'f_pending':k==='approved'?'f_approved':'f_rejected')+'</button>'}).join('');
 return '<div class="seg" style="max-width:440px;margin-bottom:14px">'+seg+'</div>'+
  '<div class="card" style="display:flex;gap:12px;align-items:center;padding:14px 18px;margin-bottom:14px">'+
  '<div class="icon-tile tile-brand">'+I.send+'</div><span class="tiny muted">'+t('orders_note')+'</span></div>'+
  '<div class="card"><div class="rows">'+(list.length?list.map(orderRow).join(''):'<div class="empty">'+t('f_all')+' — 0</div>')+'</div></div>';
}

/* ---------- settings ---------- */
function setLangTo(l){if(LANG!==l){LANG=l;store('bp_lang',l);applyHtml();renderApp()}}
function setDarkTo(d){if(DARK!==d){DARK=d;store('bp_dark',d?'1':'0');applyHtml();renderApp()}}
function vSet(){
 return '<div class="grid-2 stagger">'+
 '<div class="card"><div class="card-head">'+I.lang+'<div style="flex:1"><h3>'+t('set_lang')+'</h3><div class="hint">'+t('set_lang_sub')+'</div></div></div>'+
  '<div class="card-pad"><div class="seg">'+
   '<button class="'+(LANG==='fa'?'on':'')+'" onclick="setLangTo(\'fa\')">فارسی</button>'+
   '<button class="'+(LANG==='en'?'on':'')+'" onclick="setLangTo(\'en\')">English</button></div>'+
  '<div class="tiny" style="font-weight:700;margin:16px 0 8px">'+t('set_appear')+'</div>'+
  '<div class="seg">'+
   '<button class="'+(!DARK?'on':'')+'" onclick="setDarkTo(false)">'+I.sun+t('light')+'</button>'+
   '<button class="'+(DARK?'on':'')+'" onclick="setDarkTo(true)">'+I.moon+t('dark')+'</button></div></div></div>'+
 '<div class="card"><div class="card-head">'+I.shield+'<h3 style="flex:1">'+t('set_panel')+'</h3></div><div class="card-pad">'+
  '<div class="field" style="margin-bottom:12px"><label>'+t('panel_name')+'</label><input class="input" value="'+(LANG==='fa'?'پنل بشار':'Bashar Panel')+'"></div>'+
  '<div class="field" style="margin-bottom:12px"><label>'+t('pub_url')+'</label><input class="input mono" style="direction:ltr" value="'+PANEL_URL+'"></div>'+
  '<div class="grid-2"><div class="field"><label>'+t('new_pass')+'</label><input class="input" type="password" placeholder="••••••••"></div>'+
   '<div class="field"><label>'+t('new_pass2')+'</label><input class="input" type="password" placeholder="••••••••"></div></div>'+
  '<button class="btn btn-primary" style="margin-top:14px" onclick="toast(t(\'saved\'))">'+I.check+t('save')+'</button></div></div>'+
 '<div class="card"><div class="card-head">'+I.send+'<h3 style="flex:1">'+t('set_tg')+'</h3></div><div class="card-pad">'+
  '<div class="field" style="margin-bottom:12px"><label>'+t('bot_token')+'</label><input class="input mono" style="direction:ltr" type="password" value="7284491:AAH-bashar-bot-token-demo"></div>'+
  '<div class="grid-2" style="margin-bottom:12px"><div class="field"><label>'+t('admin_ids')+'</label><input class="input mono" style="direction:ltr" value="66221144, 88993322"></div>'+
   '<div class="field"><label>'+t('channel')+'</label><input class="input mono" style="direction:ltr" value="@bashar_vpns"></div></div>'+
  '<div class="field" style="margin-bottom:14px"><label>'+t('run_mode')+'</label><select class="input mono" style="direction:ltr"><option>long-polling</option><option>webhook</option></select></div>'+
  '<button class="btn btn-primary" onclick="toast(t(\'saved\'))">'+I.check+t('save')+'</button></div></div>'+
 '<div class="card"><div class="card-head">'+I.download+'<h3 style="flex:1">'+t('set_data')+'</h3></div><div class="card-pad">'+
  '<div class="kv"><span class="k">'+t('db_path')+'</span><span class="v mono">/data/panel.db</span></div>'+
  '<div class="kv"><span class="k">Bashar Panel</span><span class="v mono">v2.0</span></div>'+
  '<button class="btn btn-ghost" style="margin-top:13px" onclick="toast(t(\'saved\'))">'+I.download+t('download_db')+'</button></div></div>'+
 '</div>';
}

/* ================= init ================= */
LANG=store('bp_lang')||'fa';
DARK=store('bp_dark')==='1';
applyHtml();
renderLogin();
</script>
</body>
</html>
