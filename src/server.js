require('dotenv').config();
const express = require('express');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Serve index inline as fallback to avoid static file caching issues
const INDEX_HTML = '<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>AI Video Studio</title>\n<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet">\n<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css">\n<style>\n*{box-sizing:border-box;margin:0;padding:0}\n:root{\n  --brand:#0a0a14;--accent:#ff3d5a;--accent2:#00c896;--accent3:#7c3aed;\n  --surface:#f5f4f1;--card:#fff;--muted:#8a8a9a;--border:rgba(0,0,0,.07);\n  --text:#0a0a14;--text2:#4a4a6a;--shadow:0 2px 16px rgba(0,0,0,.06);\n}\nbody{font-family:\'DM Sans\',sans-serif;background:var(--surface);color:var(--text);min-height:100vh}\n.layout{display:flex;min-height:100vh}\n\n/* SIDEBAR */\n.sidebar{width:230px;background:var(--brand);padding:24px 16px;display:flex;flex-direction:column;gap:4px;position:fixed;top:0;left:0;height:100vh;z-index:100;overflow-y:auto}\n.logo{display:flex;align-items:center;gap:10px;margin-bottom:20px;padding-bottom:18px;border-bottom:.5px solid rgba(255,255,255,.1)}\n.logo-icon{width:34px;height:34px;background:var(--accent);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px;flex-shrink:0}\n.logo-name{font-family:\'Syne\',sans-serif;font-size:14px;font-weight:800;color:#fff;line-height:1.2}\n.logo-ver{font-size:10px;color:rgba(255,255,255,.35)}\n.nav-lbl{font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:rgba(255,255,255,.25);padding:12px 10px 5px}\n.nav-a{display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:8px;color:rgba(255,255,255,.5);font-size:13px;cursor:pointer;transition:all .15s;text-decoration:none}\n.nav-a:hover{background:rgba(255,255,255,.06);color:rgba(255,255,255,.8)}\n.nav-a.on{background:rgba(255,255,255,.1);color:#fff}\n.nav-a i{font-size:16px;flex-shrink:0}\n.sidebar-foot{margin-top:auto;padding-top:14px;border-top:.5px solid rgba(255,255,255,.08)}\n.api-box{background:rgba(255,255,255,.05);border-radius:8px;padding:11px}\n.api-box-t{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:rgba(255,255,255,.3);margin-bottom:8px}\n.api-row{display:flex;align-items:center;gap:7px;font-size:11px;color:rgba(255,255,255,.45);margin-bottom:4px}\n.dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.15);flex-shrink:0;transition:background .3s}\n.dot.on{background:var(--accent2)}\n\n/* MAIN */\n.main{margin-left:230px;flex:1;padding:32px 36px;max-width:calc(100% - 230px)}\n.pg{display:none}.pg.on{display:block}\n\n/* PAGE HEADER */\n.ph{margin-bottom:28px}\n.pbadge{display:inline-flex;align-items:center;gap:5px;background:var(--brand);color:#fff;font-size:10px;font-family:\'Syne\',sans-serif;font-weight:700;letter-spacing:.1em;text-transform:uppercase;padding:4px 12px;border-radius:100px;margin-bottom:11px}\n.bdot{width:5px;height:5px;background:var(--accent2);border-radius:50%;animation:blink 2s infinite}\n@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}\nh1{font-family:\'Syne\',sans-serif;font-size:30px;font-weight:800;line-height:1.15;margin-bottom:5px}\nh1 em{color:var(--accent);font-style:normal}\n.psub{font-size:13px;color:var(--muted);font-weight:300}\n\n/* CARDS */\n.card{background:var(--card);border-radius:13px;border:.5px solid var(--border);padding:20px;margin-bottom:14px;box-shadow:var(--shadow)}\n.ct{font-family:\'Syne\',sans-serif;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:11px;display:flex;align-items:center;gap:6px}\n.ct i{font-size:15px;color:var(--accent)}\n.ct i.g{color:var(--accent2)}.ct i.p{color:var(--accent3)}.ct i.a{color:#f59e0b}\n\n/* FORMS */\ntextarea,input,select{font-family:\'DM Sans\',sans-serif;font-size:13px;color:var(--text);background:var(--surface);border:.5px solid var(--border);border-radius:8px;outline:none;transition:border-color .2s;width:100%}\ntextarea{padding:12px;resize:none;line-height:1.6}\ninput{padding:9px 12px;height:38px}\nselect{padding:8px 12px;height:38px;cursor:pointer}\ntextarea:focus,input:focus,select:focus{border-color:var(--accent);background:#fff}\ntextarea::placeholder,input::placeholder{color:var(--muted);font-style:italic;font-weight:300}\n.row2{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:11px}\n.fi label{font-size:11px;color:var(--muted);font-weight:500;display:block;margin-bottom:4px}\n.fi label span{color:var(--accent)}\n\n/* BUTTONS */\n.btn{padding:11px 18px;border-radius:9px;font-family:\'Syne\',sans-serif;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:all .15s;border:none}\n.btn:active{transform:scale(.98)}\n.btn-p{background:var(--brand);color:#fff;width:100%;margin-top:8px;padding:14px}\n.btn-p:hover{opacity:.88}\n.btn-p:disabled{opacity:.35;cursor:not-allowed;transform:none}\n.btn-g{background:var(--accent2);color:#003d2d}\n.btn-g:hover{opacity:.9}\n.btn-gh{background:transparent;border:.5px solid var(--border);color:var(--text2);font-family:\'DM Sans\',sans-serif;font-weight:500}\n.btn-gh:hover{background:var(--surface)}\n.btn-row{display:flex;gap:9px;flex-wrap:wrap;margin-top:14px;align-items:center}\n\n/* STEP BAR */\n.stepbar{display:flex;align-items:center;background:var(--card);border-radius:11px;padding:12px 18px;border:.5px solid var(--border);box-shadow:var(--shadow);margin-bottom:20px}\n.stp{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:500;color:var(--muted);white-space:nowrap}\n.stp.on{color:var(--accent);font-weight:600}\n.stp.done{color:var(--accent2)}\n.stp-d{width:20px;height:20px;border-radius:50%;background:var(--surface);border:.5px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0}\n.stp.on .stp-d{background:var(--accent);color:#fff;border-color:var(--accent)}\n.stp.done .stp-d{background:var(--accent2);color:#fff;border-color:var(--accent2)}\n.stp-l{flex:1;height:1px;background:var(--border);margin:0 7px}\n.stp-l.done{background:var(--accent2)}\n\n/* SECTIONS */\n.sec{display:none}.sec.on{display:block}\n\n/* LOADING */\n.lbox{text-align:center;padding:44px 20px}\n.spin{width:38px;height:38px;border:2.5px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:sp 1s linear infinite;margin:0 auto 14px}\n.spin.g{border-top-color:var(--accent2)}\n@keyframes sp{to{transform:rotate(360deg)}}\n.lt{font-family:\'Syne\',sans-serif;font-size:15px;font-weight:700;margin-bottom:5px}\n.ls{font-size:12px;color:var(--muted)}\n.prog-w{background:var(--surface);border-radius:100px;height:5px;margin:14px 0 4px;overflow:hidden;border:.5px solid var(--border)}\n.prog-f{height:100%;background:var(--accent2);border-radius:100px;transition:width .5s ease}\n.prog-lbl{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}\n\n/* SCORES */\n.scores{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}\n.sc{background:var(--surface);border-radius:9px;padding:13px;text-align:center;border:.5px solid var(--border)}\n.sc-n{font-family:\'Syne\',sans-serif;font-size:24px;font-weight:800;margin-bottom:1px}\n.sc-l{font-size:10px;color:var(--muted);font-weight:500;text-transform:uppercase;letter-spacing:.05em}\n\n/* SUGGESTIONS */\n.sug-list{display:flex;flex-direction:column;gap:8px}\n.sug{background:var(--surface);border-radius:8px;padding:11px 14px;border-left:2.5px solid var(--accent)}\n.sug.ret{border-left-color:#7c3aed}\n.sug.eng{border-left-color:var(--accent2)}\n.sug.seo{border-left-color:#f59e0b}\n.sug-l{font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px;color:var(--accent);display:flex;align-items:center;gap:3px}\n.sug.ret .sug-l{color:#7c3aed}.sug.eng .sug-l{color:var(--accent2)}.sug.seo .sug-l{color:#f59e0b}\n.sug-t{font-size:12px;color:var(--text2);line-height:1.5}\n\n/* MUSIC */\n.mnote{background:#fffbeb;border:.5px solid #fde68a;border-radius:8px;padding:11px 13px;font-size:12px;color:#78350f;margin-bottom:13px;display:flex;gap:7px;line-height:1.5}\n.mnote i{font-size:14px;color:#f59e0b;flex-shrink:0;margin-top:1px}\n.mrec{background:var(--surface);border-radius:9px;padding:14px;margin-bottom:9px;border:.5px solid var(--border)}\n.mtag{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:100px;margin-bottom:6px}\n.tt{background:#fef3c7;color:#92400e}.to{background:#d1fae5;color:#065f46}.te{background:#ede9fe;color:#4c1d95}\n.mname{font-family:\'Syne\',sans-serif;font-size:13px;font-weight:700;margin-bottom:3px}\n.mmeta{font-size:11px;color:var(--muted);display:flex;gap:10px;flex-wrap:wrap;margin-bottom:7px}\n.mmeta span{display:flex;align-items:center;gap:3px}\n.mwhy{font-size:12px;color:var(--text2);line-height:1.5;border-top:.5px solid var(--border);padding-top:8px}\n.btn-sel{padding:6px 13px;background:transparent;border:.5px solid var(--border);border-radius:7px;font-size:12px;font-family:\'DM Sans\',sans-serif;color:var(--text2);cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin-top:9px}\n.btn-sel:hover{border-color:var(--accent2);color:var(--accent2)}\n.btn-sel.on{background:#d1fae5;border-color:var(--accent2);color:#065f46;font-weight:500}\n.sel-ban{background:#d1fae5;border:.5px solid var(--accent2);border-radius:8px;padding:11px 14px;display:none;align-items:center;gap:9px;margin-bottom:13px}\n.sel-ban i{color:var(--accent2);font-size:18px}\n.sel-n{font-size:13px;font-weight:500;color:#065f46}\n.sel-s{font-size:11px;color:#047857}\naudio{width:100%;margin-top:9px;border-radius:7px;height:34px}\n\n/* SCRIPT BLOCKS */\n.blk{background:var(--surface);border-radius:8px;padding:13px 15px;margin-bottom:9px;border-left:2.5px solid var(--border)}\n.blk.intro{border-left-color:var(--accent)}\n.blk.scene{border-left-color:#378add}\n.blk.cta{border-left-color:var(--accent2)}\n.blk-l{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:5px;display:flex;align-items:center;gap:4px}\n.blk.intro .blk-l{color:var(--accent)}.blk.scene .blk-l{color:#378add}.blk.cta .blk-l{color:var(--accent2)}\n.blk-t{font-size:13px;color:var(--text2);line-height:1.65}\n.blk-p{font-size:11px;color:var(--muted);margin-top:7px;font-style:italic;border-top:.5px solid var(--border);padding-top:6px;line-height:1.45}\n\n/* CHECKLIST */\n.chk-l{display:flex;flex-direction:column;gap:8px}\n.chk{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:var(--text2);line-height:1.5}\n.chk i{font-size:15px;flex-shrink:0;margin-top:1px}\n\n/* FINAL */\n.fhero{background:var(--brand);border-radius:14px;padding:30px;color:#fff;text-align:center;margin-bottom:14px;position:relative;overflow:hidden}\n.fhero::before{content:\'\';position:absolute;top:-50px;right:-50px;width:220px;height:220px;background:rgba(0,200,150,.05);border-radius:50%}\n.ficon{font-size:48px;color:var(--accent2);margin-bottom:11px}\n.ft{font-family:\'Syne\',sans-serif;font-size:21px;font-weight:800;margin-bottom:5px}\n.fs{font-size:12px;color:rgba(255,255,255,.5);margin-bottom:18px}\n.fmeta{display:flex;justify-content:center;gap:18px;flex-wrap:wrap;margin-bottom:20px}\n.fm{font-size:12px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:4px}\n.fm i{color:var(--accent2);font-size:13px}\n.btn-dl{padding:12px 28px;background:var(--accent2);color:#003d2d;border:none;border-radius:9px;font-family:\'Syne\',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px}\n.btn-dl:hover{opacity:.9}\n.btn-nv{padding:10px 20px;background:rgba(255,255,255,.08);color:#fff;border:.5px solid rgba(255,255,255,.15);border-radius:9px;font-size:12px;font-family:\'DM Sans\',sans-serif;cursor:pointer;margin-left:8px}\n.btn-nv:hover{background:rgba(255,255,255,.13)}\n\n/* SETTINGS */\n.set-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}\n.set-card{background:var(--card);border-radius:11px;border:.5px solid var(--border);padding:17px;box-shadow:var(--shadow)}\n.set-t{font-family:\'Syne\',sans-serif;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:11px;display:flex;align-items:center;justify-content:space-between}\n.pill{font-size:10px;padding:3px 8px;border-radius:100px;font-weight:600}\n.pill-ok{background:#d1fae5;color:#065f46}.pill-no{background:#fee2e2;color:#991b1b}\n.save-b{padding:8px 16px;background:var(--brand);color:#fff;border:none;border-radius:7px;font-family:\'Syne\',sans-serif;font-size:11px;font-weight:700;cursor:pointer;margin-top:9px;width:100%}\n.save-b:hover{opacity:.88}\n.save-ok{font-size:11px;color:var(--accent2);margin-top:5px;display:none;text-align:center}\n\n/* ERROR */\n.err{background:#fff0f0;border:.5px solid #fecaca;border-radius:8px;padding:12px 14px;color:#b91c1c;font-size:12px;display:none;align-items:flex-start;gap:7px;margin-bottom:11px;line-height:1.5}\n.err i{font-size:14px;flex-shrink:0;margin-top:1px}\n\n/* HELP */\n.cost-row{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:.5px solid var(--border);font-size:13px}\n.cost-row:last-child{border:none;font-weight:600}\n.cost-v{font-family:\'Syne\',sans-serif;font-weight:700}\n.cost-v.g{color:var(--accent2)}\n\n/* HISTORY */\n.hist-empty{text-align:center;padding:44px 20px;color:var(--muted)}\n.hist-empty i{font-size:44px;display:block;margin-bottom:11px;opacity:.3}\n.hi{background:var(--card);border-radius:11px;border:.5px solid var(--border);padding:15px 17px;margin-bottom:9px;display:flex;align-items:center;gap:13px;box-shadow:var(--shadow)}\n.hi-ico{width:38px;height:38px;background:var(--surface);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--accent);flex-shrink:0}\n.hi-info{flex:1}\n.hi-t{font-size:13px;font-weight:500;margin-bottom:2px}\n.hi-m{font-size:11px;color:var(--muted);display:flex;gap:9px;flex-wrap:wrap}\n\n/* STATS */\n.stat-g{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:18px}\n.stat-c{background:var(--card);border-radius:11px;border:.5px solid var(--border);padding:15px;text-align:center;box-shadow:var(--shadow)}\n.stat-n{font-family:\'Syne\',sans-serif;font-size:26px;font-weight:800;margin-bottom:2px}\n.stat-l{font-size:11px;color:var(--muted)}\n\n@media(max-width:768px){\n  .sidebar{width:56px;padding:14px 8px}\n  .logo-name,.logo-ver,.nav-a span,.nav-lbl,.api-box-t,.api-row span{display:none}\n  .logo{justify-content:center}.main{margin-left:56px;max-width:calc(100% - 56px);padding:18px 14px}\n  .set-grid{grid-template-columns:1fr}.stat-g{grid-template-columns:1fr 1fr}.row2{grid-template-columns:1fr}\n}\n</style>\n</head>\n<body>\n<div class="layout">\n\n<!-- SIDEBAR -->\n<div class="sidebar">\n  <div class="logo">\n    <div class="logo-icon"><i class="ti ti-video"></i></div>\n    <div><div class="logo-name">AI Video<br>Studio</div><div class="logo-ver">v2.0</div></div>\n  </div>\n  <span class="nav-lbl">Principal</span>\n  <a class="nav-a on" id="nav-crear" onclick="showPg(\'crear\')"><i class="ti ti-plus"></i><span>Crear video</span></a>\n  <a class="nav-a" id="nav-historial" onclick="showPg(\'historial\')"><i class="ti ti-history"></i><span>Historial</span></a>\n  <a class="nav-a" id="nav-stats" onclick="showPg(\'stats\')"><i class="ti ti-chart-bar"></i><span>Estadísticas</span></a>\n  <span class="nav-lbl">Config</span>\n  <a class="nav-a" id="nav-settings" onclick="showPg(\'settings\')"><i class="ti ti-settings"></i><span>API Keys</span></a>\n  <a class="nav-a" id="nav-ayuda" onclick="showPg(\'ayuda\')"><i class="ti ti-help"></i><span>Ayuda</span></a>\n  <div class="sidebar-foot">\n    <div class="api-box">\n      <div class="api-box-t">Estado APIs</div>\n      <div class="api-row"><div class="dot" id="d-claude"></div><span>Claude</span></div>\n      <div class="api-row"><div class="dot" id="d-eleven"></div><span>ElevenLabs</span></div>\n      <div class="api-row"><div class="dot" id="d-replicate"></div><span>Replicate</span></div>\n      <div class="api-row"><div class="dot" id="d-pixabay"></div><span>Pixabay</span></div>\n    </div>\n  </div>\n</div>\n\n<!-- MAIN -->\n<div class="main">\n\n<!-- CREAR -->\n<div id="pg-crear" class="pg on">\n  <div class="ph">\n    <div class="pbadge"><span class="bdot"></span>Nuevo video</div>\n    <h1>De tu idea al <em>MP4 listo</em></h1>\n    <p class="psub">Imágenes IA · Voz realista · Música automática · Subtítulos · MP4 1080p</p>\n  </div>\n\n  <div class="stepbar">\n    <div class="stp on" id="s1"><div class="stp-d">1</div><span>Idea</span></div>\n    <div class="stp-l" id="l1"></div>\n    <div class="stp" id="s2"><div class="stp-d">2</div><span>Análisis</span></div>\n    <div class="stp-l" id="l2"></div>\n    <div class="stp" id="s3"><div class="stp-d">3</div><span>Música</span></div>\n    <div class="stp-l" id="l3"></div>\n    <div class="stp" id="s4"><div class="stp-d">4</div><span>Guión</span></div>\n    <div class="stp-l" id="l4"></div>\n    <div class="stp" id="s5"><div class="stp-d">5</div><span>Video</span></div>\n  </div>\n\n  <!-- INPUT -->\n  <div id="sec-input" class="sec on">\n    <div class="card">\n      <div class="ct"><i class="ti ti-bulb"></i>Tu idea de video</div>\n      <textarea id="idea" rows="3" placeholder="Ej: quiero un video sobre la importancia de ahorrar dinero desde joven para lograr libertad financiera..."></textarea>\n      <div class="row2">\n        <div class="fi"><label>Duración</label>\n          <select id="dur"><option value="corto">Corto (1–2 min)</option><option value="medio" selected>Estándar (3–5 min)</option><option value="largo">Largo (8–10 min)</option></select>\n        </div>\n        <div class="fi"><label>Tono</label>\n          <select id="tono"><option value="educativo">Educativo</option><option value="motivacional">Motivacional</option><option value="entretenido">Entretenido</option><option value="profesional">Profesional</option></select>\n        </div>\n      </div>\n    </div>\n    <div class="err" id="err-i"><i class="ti ti-alert-circle"></i><span id="err-i-m"></span></div>\n    <button class="btn btn-p" id="btn-go" onclick="doAnalyze()"><i class="ti ti-sparkles"></i>Analizar idea y buscar música</button>\n  </div>\n\n  <!-- LOADING -->\n  <div id="sec-load" class="sec">\n    <div class="card"><div class="lbox">\n      <div class="spin"></div>\n      <div class="lt" id="lt">Analizando tu idea...</div>\n      <div class="ls" id="ls">La IA evalúa retención y tendencias musicales</div>\n    </div></div>\n  </div>\n\n  <!-- MUSIC + SUGGESTIONS -->\n  <div id="sec-music" class="sec">\n    <div class="card">\n      <div class="ct"><i class="ti ti-chart-bar"></i>Potencial del video</div>\n      <div class="scores">\n        <div class="sc"><div class="sc-n" id="s-ret" style="color:var(--accent2)">—</div><div class="sc-l">Retención</div></div>\n        <div class="sc"><div class="sc-n" id="s-eng" style="color:#7c3aed">—</div><div class="sc-l">Engagement</div></div>\n        <div class="sc"><div class="sc-n" id="s-seo" style="color:#f59e0b">—</div><div class="sc-l">SEO</div></div>\n      </div>\n      <div class="sug-list" id="sugs"></div>\n    </div>\n    <div class="card">\n      <div class="ct"><i class="ti ti-music g"></i>Música recomendada por IA</div>\n      <div class="mnote"><i class="ti ti-trending-up"></i>La música correcta aumenta la retención hasta un 40%. Elegí la que mejor va con tu video.</div>\n      <div id="mrecs"></div>\n      <div class="sel-ban" id="sel-ban">\n        <i class="ti ti-circle-check"></i>\n        <div style="flex:1"><div class="sel-n" id="sel-n">—</div><div class="sel-s">Se mezclará automáticamente en el video</div></div>\n        <button class="btn-gh" style="padding:5px 11px;font-size:11px" onclick="clearSel()">Cambiar</button>\n      </div>\n    </div>\n    <div class="card">\n      <div class="ct"><i class="ti ti-pencil"></i>Idea optimizada</div>\n      <textarea id="idea-opt" rows="3"></textarea>\n      <div class="btn-row">\n        <button class="btn btn-gh" onclick="goSec(\'sec-input\',1)"><i class="ti ti-arrow-left"></i>Cambiar idea</button>\n        <button class="btn btn-g" onclick="doScript()"><i class="ti ti-player-play"></i>Generar guión</button>\n      </div>\n    </div>\n  </div>\n\n  <!-- SCRIPT -->\n  <div id="sec-script" class="sec">\n    <div class="card">\n      <div class="ct"><i class="ti ti-file-text"></i>Guión completo</div>\n      <div id="scr-t" style="font-family:\'Syne\',sans-serif;font-size:15px;font-weight:700;margin-bottom:3px"></div>\n      <div id="scr-d" style="font-size:12px;color:var(--muted);margin-bottom:14px"></div>\n      <div id="scr-b"></div>\n    </div>\n    <div class="card">\n      <div class="ct"><i class="ti ti-settings"></i>Configuración del video</div>\n      <div class="chk-l" id="vcfg"></div>\n    </div>\n    <div class="btn-row">\n      <button class="btn btn-gh" onclick="goSec(\'sec-music\',3)"><i class="ti ti-arrow-left"></i>Volver</button>\n      <button class="btn btn-g" onclick="doVideo()"><i class="ti ti-video"></i>¡Generar video MP4!</button>\n    </div>\n  </div>\n\n  <!-- BUILDING -->\n  <div id="sec-build" class="sec">\n    <div class="card"><div class="lbox">\n      <div class="spin g"></div>\n      <div class="lt" id="bt">Generando imágenes...</div>\n      <div class="ls" id="bs">Iniciando proceso...</div>\n      <div class="prog-w"><div class="prog-f" id="pf" style="width:0%"></div></div>\n      <div class="prog-lbl"><span id="pp">0%</span><span id="pl">Iniciando...</span></div>\n    </div></div>\n  </div>\n\n  <!-- FINAL -->\n  <div id="sec-final" class="sec">\n    <div class="fhero">\n      <div class="ficon"><i class="ti ti-circle-check"></i></div>\n      <div class="ft">¡Video MP4 listo para YouTube!</div>\n      <div class="fs" id="fml">Con música seleccionada por IA</div>\n      <div class="fmeta">\n        <div class="fm"><i class="ti ti-clock"></i><span id="fdur">—</span></div>\n        <div class="fm"><i class="ti ti-device-tv"></i>1080p · 16:9</div>\n        <div class="fm"><i class="ti ti-music"></i>Música mezclada</div>\n        <div class="fm"><i class="ti ti-subtask"></i>Subtítulos</div>\n      </div>\n      <div>\n        <button class="btn-dl" id="btn-dl" onclick="doDownload()"><i class="ti ti-download"></i>Descargar MP4</button>\n        <button class="btn-nv" onclick="resetCrear()">+ Nuevo video</button>\n      </div>\n    </div>\n    <div class="card">\n      <div class="ct"><i class="ti ti-shield-check"></i>Checklist antes de subir</div>\n      <div class="chk-l">\n        <div class="chk"><i class="ti ti-check" style="color:var(--accent2)"></i>Marcá "contenido alterado o sintético" en YouTube Studio</div>\n        <div class="chk"><i class="ti ti-check" style="color:var(--accent2)"></i>Diseñá una miniatura propia en Canva (sube el CTR un 30%)</div>\n        <div class="chk"><i class="ti ti-check" style="color:var(--accent2)"></i>Personalizá título y descripción con palabras clave</div>\n        <div class="chk"><i class="ti ti-check" style="color:var(--accent2)"></i>Agregá capítulos en la descripción para mejorar retención</div>\n        <div class="chk"><i class="ti ti-check" style="color:var(--accent2)"></i>La música de Pixabay no requiere atribución en videos monetizados</div>\n      </div>\n    </div>\n    <button class="btn btn-p" style="background:var(--surface);color:var(--text);border:.5px solid var(--border)" onclick="resetCrear()"><i class="ti ti-plus"></i>Crear otro video</button>\n  </div>\n</div>\n\n<!-- HISTORIAL -->\n<div id="pg-historial" class="pg">\n  <div class="ph"><div class="pbadge"><span class="bdot"></span>Historial</div><h1>Videos <em>generados</em></h1><p class="psub">Todos los videos que creaste</p></div>\n  <div id="hist-c"></div>\n</div>\n\n<!-- STATS -->\n<div id="pg-stats" class="pg">\n  <div class="ph"><div class="pbadge"><span class="bdot"></span>Estadísticas</div><h1>Tu <em>producción</em></h1><p class="psub">Resumen de uso y costos estimados</p></div>\n  <div class="stat-g">\n    <div class="stat-c"><div class="stat-n" id="st-tot" style="color:var(--accent)">0</div><div class="stat-l">Videos generados</div></div>\n    <div class="stat-c"><div class="stat-n" id="st-mes" style="color:#7c3aed">0</div><div class="stat-l">Este mes</div></div>\n    <div class="stat-c"><div class="stat-n" id="st-cst" style="color:var(--accent2)">$0</div><div class="stat-l">Costo estimado</div></div>\n    <div class="stat-c"><div class="stat-n" id="st-cpv" style="color:#f59e0b">$0</div><div class="stat-l">Costo por video</div></div>\n  </div>\n  <div class="card">\n    <div class="ct"><i class="ti ti-receipt a"></i>Desglose por API</div>\n    <div class="cost-row"><span style="color:var(--text2)">Claude API</span><span class="cost-v" id="cc">$0.00</span></div>\n    <div class="cost-row"><span style="color:var(--text2)">ElevenLabs</span><span class="cost-v" id="ce">$0.00</span></div>\n    <div class="cost-row"><span style="color:var(--text2)">Replicate</span><span class="cost-v" id="cr">$0.00</span></div>\n    <div class="cost-row"><span style="color:var(--text2)">Pixabay</span><span class="cost-v g">Gratis</span></div>\n    <div class="cost-row"><span>Total</span><span class="cost-v" id="ct-t">$0.00</span></div>\n  </div>\n</div>\n\n<!-- SETTINGS -->\n<div id="pg-settings" class="pg">\n  <div class="ph"><div class="pbadge"><span class="bdot"></span>Configuración</div><h1>API <em>Keys</em></h1><p class="psub">Guardadas en el servidor — configuradas una sola vez</p></div>\n  <div class="set-grid">\n    <div class="set-card">\n      <div class="set-t">Claude API <span class="pill" id="p-claude">Sin configurar</span></div>\n      <div class="fi"><label>API Key <span>*</span></label><input type="password" id="k-claude" placeholder="sk-ant-api03-..."></div>\n      <p style="font-size:11px;color:var(--muted);margin-top:7px;line-height:1.5">console.anthropic.com → API Keys<br>Cargá $5 en Billing — dura meses.</p>\n      <button class="save-b" onclick="saveKey(\'claude\')"><i class="ti ti-device-floppy"></i> Guardar</button>\n      <div class="save-ok" id="ok-claude"><i class="ti ti-check"></i> Guardada</div>\n    </div>\n    <div class="set-card">\n      <div class="set-t">ElevenLabs <span class="pill" id="p-eleven">Sin configurar</span></div>\n      <div class="fi"><label>API Key</label><input type="password" id="k-eleven" placeholder="sk_..."></div>\n      <div class="fi" style="margin-top:8px"><label>Voice ID</label><input type="text" id="k-voice" placeholder="21m00Tcm4TlvDq8ikWAM"></div>\n      <p style="font-size:11px;color:var(--muted);margin-top:7px;line-height:1.5">Plan free: ~5 videos/mes<br>Starter $22/mes: ~120 videos/mes</p>\n      <button class="save-b" onclick="saveKey(\'eleven\')"><i class="ti ti-device-floppy"></i> Guardar</button>\n      <div class="save-ok" id="ok-eleven"><i class="ti ti-check"></i> Guardada</div>\n    </div>\n    <div class="set-card">\n      <div class="set-t">Replicate <span class="pill" id="p-replicate">Sin configurar</span></div>\n      <div class="fi"><label>API Token</label><input type="password" id="k-replicate" placeholder="r8_..."></div>\n      <p style="font-size:11px;color:var(--muted);margin-top:7px;line-height:1.5">replicate.com → Account → API Tokens<br>Cargá $10 → ~650 imágenes</p>\n      <button class="save-b" onclick="saveKey(\'replicate\')"><i class="ti ti-device-floppy"></i> Guardar</button>\n      <div class="save-ok" id="ok-replicate"><i class="ti ti-check"></i> Guardada</div>\n    </div>\n    <div class="set-card">\n      <div class="set-t">Pixabay <span class="pill" id="p-pixabay">Sin configurar</span></div>\n      <div class="fi"><label>API Key</label><input type="password" id="k-pixabay" placeholder="12345678-abc..."></div>\n      <p style="font-size:11px;color:var(--muted);margin-top:7px;line-height:1.5">pixabay.com/api/docs<br>100% gratuita · música libre de derechos</p>\n      <button class="save-b" onclick="saveKey(\'pixabay\')"><i class="ti ti-device-floppy"></i> Guardar</button>\n      <div class="save-ok" id="ok-pixabay"><i class="ti ti-check"></i> Guardada</div>\n    </div>\n  </div>\n</div>\n\n<!-- AYUDA -->\n<div id="pg-ayuda" class="pg">\n  <div class="ph"><div class="pbadge"><span class="bdot"></span>Ayuda</div><h1>Cómo usar la <em>app</em></h1><p class="psub">Guía rápida y recursos útiles</p></div>\n  <div class="card">\n    <div class="ct"><i class="ti ti-list-numbers"></i>Flujo de trabajo</div>\n    <div class="chk-l">\n      <div class="chk"><i class="ti ti-circle-number-1" style="color:var(--accent)"></i>Configurá tus API Keys en la sección "API Keys" del menú lateral</div>\n      <div class="chk"><i class="ti ti-circle-number-2" style="color:var(--accent)"></i>Escribí tu idea de video y elegí duración y tono</div>\n      <div class="chk"><i class="ti ti-circle-number-3" style="color:var(--accent)"></i>Revisá las sugerencias de retención y elegí la música ideal</div>\n      <div class="chk"><i class="ti ti-circle-number-4" style="color:var(--accent)"></i>Revisá el guión generado con IA escena por escena</div>\n      <div class="chk"><i class="ti ti-circle-number-5" style="color:var(--accent)"></i>Hacé clic en "Generar video MP4" y esperá 3–5 minutos</div>\n      <div class="chk"><i class="ti ti-circle-number-6" style="color:var(--accent)"></i>Descargá el MP4 listo para subir a YouTube sin editar nada</div>\n    </div>\n  </div>\n  <div class="card">\n    <div class="ct"><i class="ti ti-link"></i>Links útiles</div>\n    <div class="chk-l">\n      <div class="chk"><i class="ti ti-external-link" style="color:var(--accent2)"></i><a href="https://console.anthropic.com" target="_blank" style="color:var(--accent2);text-decoration:none">console.anthropic.com</a> — Claude API Key</div>\n      <div class="chk"><i class="ti ti-external-link" style="color:var(--accent2)"></i><a href="https://elevenlabs.io" target="_blank" style="color:var(--accent2);text-decoration:none">elevenlabs.io</a> — Voces IA en español</div>\n      <div class="chk"><i class="ti ti-external-link" style="color:var(--accent2)"></i><a href="https://replicate.com" target="_blank" style="color:var(--accent2);text-decoration:none">replicate.com</a> — Generación de imágenes IA</div>\n      <div class="chk"><i class="ti ti-external-link" style="color:var(--accent2)"></i><a href="https://pixabay.com/api/docs" target="_blank" style="color:var(--accent2);text-decoration:none">pixabay.com/api/docs</a> — Música gratis</div>\n      <div class="chk"><i class="ti ti-external-link" style="color:var(--accent2)"></i><a href="https://railway.app" target="_blank" style="color:var(--accent2);text-decoration:none">railway.app</a> — Servidor donde corre esta app</div>\n    </div>\n  </div>\n  <div class="card">\n    <div class="ct"><i class="ti ti-coin a"></i>Costos estimados para 120 videos/mes</div>\n    <div class="cost-row"><span style="color:var(--text2)">Claude API</span><span class="cost-v">~$5</span></div>\n    <div class="cost-row"><span style="color:var(--text2)">ElevenLabs Starter</span><span class="cost-v">$22</span></div>\n    <div class="cost-row"><span style="color:var(--text2)">Replicate</span><span class="cost-v">~$5</span></div>\n    <div class="cost-row"><span style="color:var(--text2)">Pixabay (música)</span><span class="cost-v g">$0</span></div>\n    <div class="cost-row"><span>Total</span><span class="cost-v">~$32/mes</span></div>\n  </div>\n</div>\n\n</div><!-- /main -->\n</div><!-- /layout -->\n\n<script>\nlet ST={idea:\'\',ideaOpt:\'\',guion:null,selMusic:null,musicRecs:[],downloadUrl:null,downloadName:null};\n\n// ── PAGE NAV ──────────────────────────────────────────────────────────────\nfunction showPg(id){\n  document.querySelectorAll(\'.pg\').forEach(p=>p.classList.remove(\'on\'));\n  document.querySelectorAll(\'.nav-a\').forEach(n=>n.classList.remove(\'on\'));\n  document.getElementById(\'pg-\'+id).classList.add(\'on\');\n  document.getElementById(\'nav-\'+id).classList.add(\'on\');\n  if(id===\'stats\')updStats();\n  if(id===\'historial\')rendHist();\n}\n\nfunction goSec(id,step){\n  document.querySelectorAll(\'.sec\').forEach(s=>s.classList.remove(\'on\'));\n  document.getElementById(id).classList.add(\'on\');\n  setStep(step);\n}\n\nfunction setStep(n){\n  for(let i=1;i<=5;i++){\n    const s=document.getElementById(\'s\'+i);if(!s)continue;\n    if(i<n){s.className=\'stp done\';s.querySelector(\'.stp-d\').innerHTML=\'<i class="ti ti-check" style="font-size:9px"></i>\';}\n    else if(i===n){s.className=\'stp on\';s.querySelector(\'.stp-d\').textContent=i;}\n    else{s.className=\'stp\';s.querySelector(\'.stp-d\').textContent=i;}\n    if(i<5){const l=document.getElementById(\'l\'+i);if(l)l.className=i<n?\'stp-l done\':\'stp-l\';}\n  }\n}\n\n// ── SETTINGS ─────────────────────────────────────────────────────────────\nasync function saveKey(k){\n  const val=document.getElementById(\'k-\'+k).value.trim();\n  const body={key:k,value:val};\n  if(k===\'eleven\'){body.voiceId=document.getElementById(\'k-voice\').value.trim();}\n  try{\n    await fetch(\'/api/config\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},body:JSON.stringify(body)});\n  }catch{}\n  const ok=document.getElementById(\'ok-\'+k);\n  ok.style.display=\'block\';setTimeout(()=>ok.style.display=\'none\',2500);\n  updDots();updPills();\n}\n\nasync function loadConfig(){\n  try{\n    const r=await fetch(\'/api/health\');\n    const d=await r.json();\n    [\'claude\',\'elevenlabs\',\'replicate\',\'pixabay\'].forEach((k,i)=>{\n      const keys=[\'claude\',\'eleven\',\'replicate\',\'pixabay\'];\n      const el=document.getElementById(\'d-\'+keys[i]);\n      if(el)el.className=\'dot\'+(d.apis[k]?\' on\':\'\');\n      const p=document.getElementById(\'p-\'+keys[i]);\n      if(p){p.className=\'pill\'+(d.apis[k]?\' pill-ok\':\' pill-no\');p.textContent=d.apis[k]?\'Configurada\':\'Sin configurar\';}\n    });\n  }catch{}\n}\n\nfunction updDots(){setTimeout(loadConfig,300);}\nfunction updPills(){setTimeout(loadConfig,300);}\n\nfunction showErr(id,msg){const e=document.getElementById(id);e.querySelector(\'span\').textContent=msg;e.style.display=\'flex\';}\nfunction hideErr(id){document.getElementById(id).style.display=\'none\';}\n\n// ── ANALYZE ───────────────────────────────────────────────────────────────\nasync function doAnalyze(){\n  const idea=document.getElementById(\'idea\').value.trim();\n  hideErr(\'err-i\');\n  if(!idea){showErr(\'err-i\',\'Escribí tu idea de video primero.\');return;}\n  ST={...ST,idea,guion:null,selMusic:null,musicRecs:[],downloadUrl:null};\n  document.getElementById(\'btn-go\').disabled=true;\n  goSec(\'sec-load\',2);\n  const msgs=[\n    [\'Analizando potencial de retención...\',\'Evaluando el nicho y tendencias actuales\'],\n    [\'Calculando engagement score...\',\'Comparando con videos virales similares\'],\n    [\'Buscando música óptima...\',\'Analizando qué suena bien en tu categoría\'],\n    [\'Generando sugerencias...\',\'Casi listo...\']\n  ];\n  let mi=0;\n  const lt=document.getElementById(\'lt\'),ls=document.getElementById(\'ls\');\n  const iv=setInterval(()=>{if(mi<msgs.length){lt.textContent=msgs[mi][0];ls.textContent=msgs[mi][1];mi++;}},1700);\n  try{\n    const res=await fetch(\'/api/analyze\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},\n      body:JSON.stringify({idea,duracion:document.getElementById(\'dur\').value,tono:document.getElementById(\'tono\').value})});\n    const data=await res.json();\n    clearInterval(iv);\n    if(!res.ok)throw new Error(data.error||\'Error del servidor\');\n    document.getElementById(\'s-ret\').textContent=data.scoreRetencion||\'—\';\n    document.getElementById(\'s-eng\').textContent=data.scoreEngagement||\'—\';\n    document.getElementById(\'s-seo\').textContent=data.scoreSEO||\'—\';\n    const sl=document.getElementById(\'sugs\');sl.innerHTML=\'\';\n    const im={retencion:\'ti-trending-up\',engagement:\'ti-heart\',seo:\'ti-search\'};\n    (data.sugerencias||[]).forEach(s=>{\n      const d=document.createElement(\'div\');d.className=\'sug \'+(s.tipo||\'\');\n      d.innerHTML=`<div class="sug-l"><i class="ti ${im[s.tipo]||\'ti-bulb\'}" style="font-size:11px;margin-right:3px"></i>${s.titulo||\'\'}</div><div class="sug-t">${s.texto||\'\'}</div>`;\n      sl.appendChild(d);\n    });\n    document.getElementById(\'idea-opt\').value=data.ideaOptimizada||idea;\n    ST.ideaOpt=data.ideaOptimizada||idea;\n    ST.musicRecs=data.musicaRecomendada||[];\n    const mr=document.getElementById(\'mrecs\');mr.innerHTML=\'\';\n    const tm={alta:\'tt\',media:\'to\',baja:\'te\'};\n    const tl={alta:\'En tendencia\',media:\'Recomendada\',baja:\'Experimental\'};\n    ST.musicRecs.forEach((m,i)=>{\n      const div=document.createElement(\'div\');div.className=\'mrec\';div.id=\'mr-\'+i;\n      div.innerHTML=`<div class="mtag ${tm[m.tendencia]||\'to\'}">${tl[m.tendencia]||\'Recomendada\'}</div>\n<div class="mname">${m.nombre||\'Track \'+(i+1)}</div>\n<div class="mmeta"><span><i class="ti ti-music"></i>${m.genero||\'\'}</span><span><i class="ti ti-mood-happy"></i>${m.mood||\'\'}</span><span><i class="ti ti-metronome"></i>${m.tempo||\'\'}</span></div>\n<div class="mwhy"><strong>Por qué funciona:</strong> ${m.porQueElegirla||\'\'}</div>\n${m.preview?`<audio controls src="${m.preview}"></audio><div style="font-size:10px;color:var(--muted);margin-top:3px">"${m.trackTitle||\'\'}" — Pixabay Music</div>`:\'<div style="font-size:11px;color:var(--muted);margin-top:7px;font-style:italic"><i class="ti ti-info-circle" style="font-size:11px"></i> Configurá Pixabay key para escuchar previews</div>\'}\n<button class="btn-sel" id="sb-${i}" onclick="selMusic(${i})"><i class="ti ti-circle-plus"></i>Usar esta música</button>`;\n      mr.appendChild(div);\n    });\n    goSec(\'sec-music\',3);\n  }catch(e){\n    clearInterval(iv);\n    document.getElementById(\'btn-go\').disabled=false;\n    goSec(\'sec-input\',1);\n    showErr(\'err-i\',\'Error: \'+e.message+\'. Verificá que el servidor esté corriendo y las API keys configuradas.\');\n  }\n}\n\nfunction selMusic(i){\n  ST.selMusic=i;\n  document.querySelectorAll(\'[id^="sb-"]\').forEach(b=>{b.className=\'btn-sel\';b.innerHTML=\'<i class="ti ti-circle-plus"></i>Usar esta música\';});\n  document.getElementById(\'sb-\'+i).className=\'btn-sel on\';\n  document.getElementById(\'sb-\'+i).innerHTML=\'<i class="ti ti-check"></i>Seleccionada\';\n  const m=ST.musicRecs[i];\n  document.getElementById(\'sel-n\').textContent=(m?.nombre||\'Track\')+(m?.genero?\' · \'+m.genero:\'\');\n  document.getElementById(\'sel-ban\').style.display=\'flex\';\n}\nfunction clearSel(){\n  ST.selMusic=null;\n  document.querySelectorAll(\'[id^="sb-"]\').forEach(b=>{b.className=\'btn-sel\';b.innerHTML=\'<i class="ti ti-circle-plus"></i>Usar esta música\';});\n  document.getElementById(\'sel-ban\').style.display=\'none\';\n}\n\n// ── SCRIPT ────────────────────────────────────────────────────────────────\nasync function doScript(){\n  const ideaFinal=document.getElementById(\'idea-opt\').value.trim()||ST.ideaOpt;\n  ST.ideaOpt=ideaFinal;\n  const sel=ST.selMusic!==null?ST.musicRecs[ST.selMusic]:null;\n  goSec(\'sec-load\',4);\n  document.getElementById(\'lt\').textContent=\'Generando guión profesional...\';\n  document.getElementById(\'ls\').textContent=\'Estructurando escenas para máxima retención\';\n  try{\n    const res=await fetch(\'/api/script\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},\n      body:JSON.stringify({idea:ideaFinal,duracion:document.getElementById(\'dur\').value,tono:document.getElementById(\'tono\').value,musicaMood:sel?.mood||\'\'})});\n    const g=await res.json();\n    if(!res.ok)throw new Error(g.error||\'Error generando guión\');\n    ST.guion=g;\n    document.getElementById(\'scr-t\').textContent=g.titulo||\'\';\n    document.getElementById(\'scr-d\').textContent=(g.descripcion||\'\')+\' · \'+(g.duracion||\'\');\n    const sb=document.getElementById(\'scr-b\');sb.innerHTML=\'\';\n    const ic={intro:\'ti-player-play\',scene:\'ti-camera\',cta:\'ti-star\'};\n    (g.escenas||[]).forEach((e,i)=>{\n      const d=document.createElement(\'div\');d.className=\'blk \'+(e.tipo||\'scene\');\n      d.innerHTML=`<div class="blk-l"><i class="ti ${ic[e.tipo]||\'ti-camera\'}"></i>${e.label||\'Escena \'+(i+1)}</div><div class="blk-t">${e.narracion||\'\'}</div><div class="blk-p"><i class="ti ti-photo" style="font-size:10px;margin-right:3px"></i>${e.promptImagen||\'\'}</div>`;\n      sb.appendChild(d);\n    });\n    const vc=document.getElementById(\'vcfg\');\n    const hasE=!!document.getElementById(\'k-eleven\').value||document.getElementById(\'p-eleven\')?.textContent===\'Configurada\';\n    const hasR=!!document.getElementById(\'k-replicate\').value||document.getElementById(\'p-replicate\')?.textContent===\'Configurada\';\n    vc.innerHTML=[\n      {ok:true,t:\'Guión: \'+((g.escenas||[]).length)+\' escenas optimizadas para retención\'},\n      {ok:true,t:\'Imágenes: Replicate SDXL (1280×720 por escena)\'},\n      {ok:true,t:\'Voz: ElevenLabs Multilingual v2\'},\n      {ok:!!sel,t:sel?`Música: "${sel.nombre}" — libre de derechos`:\'Música: sin seleccionar (se usará música genérica)\'},\n      {ok:true,t:\'Efecto: Ken Burns (zoom suave en imágenes)\'},\n      {ok:true,t:\'Exportación: MP4 1080p 16:9 listo para YouTube\'}\n    ].map(c=>`<div class="chk"><i class="ti ${c.ok?\'ti-check\':\'ti-info-circle\'}" style="color:${c.ok?\'var(--accent2)\':\'#f59e0b\'}"></i><span style="font-size:13px">${c.t}</span></div>`).join(\'\');\n    goSec(\'sec-script\',4);\n  }catch(e){\n    goSec(\'sec-music\',3);\n    alert(\'Error generando guión: \'+e.message);\n  }\n}\n\n// ── VIDEO GENERATION (SSE) ────────────────────────────────────────────────\nasync function doVideo(){\n  const sel=ST.selMusic!==null?ST.musicRecs[ST.selMusic]:null;\n  goSec(\'sec-build\',5);\n  const bt=document.getElementById(\'bt\'),bs=document.getElementById(\'bs\');\n  const pf=document.getElementById(\'pf\'),pp=document.getElementById(\'pp\'),pl=document.getElementById(\'pl\');\n\n  try{\n    const res=await fetch(\'/api/generate-video\',{method:\'POST\',headers:{\'Content-Type\':\'application/json\'},\n      body:JSON.stringify({guion:ST.guion,musicQuery:sel?.queryPixabay||\'background music\'})});\n\n    const reader=res.body.getReader();\n    const decoder=new TextDecoder();\n    let buf=\'\';\n\n    while(true){\n      const{done,value}=await reader.read();\n      if(done)break;\n      buf+=decoder.decode(value,{stream:true});\n      const lines=buf.split(\'\\n\');\n      buf=lines.pop();\n      for(const line of lines){\n        if(!line.startsWith(\'data:\'))continue;\n        try{\n          const d=JSON.parse(line.slice(5).trim());\n          if(d.type===\'progress\'){\n            bt.textContent=d.msg||\'Procesando...\';\n            bs.textContent=d.step||\'\';\n            pf.style.width=(d.pct||0)+\'%\';\n            pp.textContent=(d.pct||0)+\'%\';\n            pl.textContent=d.msg||\'\';\n          } else if(d.type===\'done\'){\n            ST.downloadUrl=d.url;\n            ST.downloadName=d.filename;\n            const secs=(ST.guion?.escenas||[]).reduce((_,e)=>_+Math.ceil((e.narracion||\'\').split(\' \').length/2.5),0);\n            const m=Math.floor(secs/60),s=secs%60;\n            document.getElementById(\'fdur\').textContent=m+\':\'+(s<10?\'0\':\'\')+s;\n            document.getElementById(\'fml\').textContent=sel?`Música: "${sel.nombre}"`:\'Música genérica libre de derechos\';\n            saveHist();\n            goSec(\'sec-final\',5);\n          } else if(d.type===\'error\'){\n            throw new Error(d.msg);\n          }\n        }catch(pe){if(pe.message&&!pe.message.includes(\'JSON\'))throw pe;}\n      }\n    }\n  }catch(e){\n    goSec(\'sec-script\',4);\n    alert(\'Error generando el video: \'+e.message+\'\\n\\nVerificá que todas las API keys estén configuradas.\');\n  }\n}\n\nfunction doDownload(){\n  if(!ST.downloadUrl){alert(\'No hay video disponible.\');return;}\n  const a=document.createElement(\'a\');\n  a.href=ST.downloadUrl;\n  a.download=ST.downloadName||\'video_youtube.mp4\';\n  a.click();\n}\n\n// ── HISTORY & STATS ───────────────────────────────────────────────────────\nfunction saveHist(){\n  const g=ST.guion;if(!g)return;\n  const item={id:Date.now(),titulo:g.titulo||\'Video sin título\',fecha:new Date().toLocaleDateString(\'es-AR\'),duracion:g.duracion||\'—\',escenas:(g.escenas||[]).length};\n  const h=JSON.parse(localStorage.getItem(\'avs_hist\')||\'[]\');\n  h.unshift(item);\n  localStorage.setItem(\'avs_hist\',JSON.stringify(h.slice(0,100)));\n}\n\nfunction rendHist(){\n  const h=JSON.parse(localStorage.getItem(\'avs_hist\')||\'[]\');\n  const c=document.getElementById(\'hist-c\');\n  if(!h.length){c.innerHTML=`<div class="hist-empty"><i class="ti ti-video-off"></i><p>Todavía no generaste ningún video.</p><br><button class="btn btn-g" onclick="showPg(\'crear\')" style="margin:0 auto"><i class="ti ti-plus"></i>Crear primer video</button></div>`;return;}\n  c.innerHTML=h.map(x=>`<div class="hi"><div class="hi-ico"><i class="ti ti-video"></i></div><div class="hi-info"><div class="hi-t">${x.titulo}</div><div class="hi-m"><span><i class="ti ti-calendar" style="font-size:10px"></i>${x.fecha}</span><span><i class="ti ti-clock" style="font-size:10px"></i>${x.duracion}</span><span><i class="ti ti-camera" style="font-size:10px"></i>${x.escenas} escenas</span></div></div></div>`).join(\'\');\n}\n\nfunction updStats(){\n  const h=JSON.parse(localStorage.getItem(\'avs_hist\')||\'[]\');\n  const tot=h.length;\n  const mes=new Date().getMonth();\n  const thisMes=h.filter(x=>{try{const d=new Date(x.fecha.split(\'/\').reverse().join(\'-\'));return d.getMonth()===mes;}catch{return false;}}).length;\n  const cst=tot*0.27;\n  document.getElementById(\'st-tot\').textContent=tot;\n  document.getElementById(\'st-mes\').textContent=thisMes;\n  document.getElementById(\'st-cst\').textContent=\'$\'+cst.toFixed(2);\n  document.getElementById(\'st-cpv\').textContent=tot?\'$0.27\':\'$0\';\n  document.getElementById(\'cc\').textContent=\'$\'+(tot*0.04).toFixed(2);\n  document.getElementById(\'ce\').textContent=\'$\'+(tot*0.18).toFixed(2);\n  document.getElementById(\'cr\').textContent=\'$\'+(tot*0.05).toFixed(2);\n  document.getElementById(\'ct-t\').textContent=\'$\'+cst.toFixed(2);\n}\n\nfunction resetCrear(){\n  ST={...ST,idea:\'\',ideaOpt:\'\',guion:null,selMusic:null,musicRecs:[],downloadUrl:null};\n  document.getElementById(\'idea\').value=\'\';\n  document.getElementById(\'btn-go\').disabled=false;\n  hideErr(\'err-i\');\n  goSec(\'sec-input\',1);\n  document.getElementById(\'sel-ban\').style.display=\'none\';\n}\n\n// ── INIT ──────────────────────────────────────────────────────────────────\nwindow.addEventListener(\'DOMContentLoaded\',()=>{\n  loadConfig();\n  updStats();\n});\n</script>\n</body>\n</html>\n';
app.get('/', (req, res) => res.send(INDEX_HTML));

const TMP = path.join(__dirname, '../tmp');
const OUT = path.join(__dirname, '../outputs');
[TMP, OUT].forEach(d => !fs.existsSync(d) && fs.mkdirSync(d, { recursive: true }));

// ── HELPERS ──────────────────────────────────────────────────────────────────

function getEnv(key) {
  return process.env[key] || '';
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
  const buf = await res.buffer();
  fs.writeFileSync(dest, buf);
}

function cleanup(files) {
  files.forEach(f => { try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {} });
}

// ── CLAUDE ───────────────────────────────────────────────────────────────────

async function callClaude(prompt, system, maxTokens = 2000) {
  const key = getEnv('CLAUDE_API_KEY');
  if (!key) throw new Error('CLAUDE_API_KEY no configurada');
  const res = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: maxTokens,
    system: system || 'Respondé SOLO en JSON válido sin backticks ni texto extra.',
    messages: [{ role: 'user', content: prompt }]
  }, {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  });
  return res.data.content.map(c => c.text || '').join('');
}

// ── ELEVENLABS ───────────────────────────────────────────────────────────────

async function generateVoice(text, outputPath) {
  const key = getEnv('ELEVENLABS_API_KEY');
  const voiceId = getEnv('ELEVENLABS_VOICE_ID') || '21m00Tcm4TlvDq8ikWAM';
  if (!key) throw new Error('ELEVENLABS_API_KEY no configurada');
  const res = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    { text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
    { headers: { 'xi-api-key': key, 'Content-Type': 'application/json' }, responseType: 'arraybuffer' }
  );
  fs.writeFileSync(outputPath, Buffer.from(res.data));
}

// ── REPLICATE (Stable Diffusion XL) ─────────────────────────────────────────

async function generateImage(prompt, outputPath) {
  const token = getEnv('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN no configurado');

  const res = await axios.post('https://api.replicate.com/v1/models/stability-ai/sdxl/predictions', {
    input: {
      prompt: prompt + ', cinematic, high quality, 16:9, professional photography',
      negative_prompt: 'blurry, low quality, ugly, deformed, watermark, text',
      width: 1280, height: 720, num_outputs: 1, num_inference_steps: 25
    }
  }, { headers: { Authorization: `Token ${token}`, 'Content-Type': 'application/json' } });

  let prediction = res.data;
  const predId = prediction.id;

  for (let i = 0; i < 60; i++) {
    await sleep(3000);
    const poll = await axios.get(`https://api.replicate.com/v1/predictions/${predId}`,
      { headers: { Authorization: `Token ${token}` } });
    prediction = poll.data;
    if (prediction.status === 'succeeded') break;
    if (prediction.status === 'failed') throw new Error('Replicate falló: ' + prediction.error);
  }

  if (!prediction.output || !prediction.output[0]) throw new Error('Replicate no devolvió imagen');
  await downloadFile(prediction.output[0], outputPath);
}

// ── PIXABAY MUSIC ────────────────────────────────────────────────────────────

async function getMusic(query, outputPath) {
  const key = getEnv('PIXABAY_API_KEY');
  if (!key) { fs.writeFileSync(outputPath, Buffer.alloc(0)); return false; }
  try {
    const res = await axios.get(`https://pixabay.com/api/music/?key=${key}&q=${encodeURIComponent(query)}&per_page=5`);
    const hits = res.data.hits || [];
    const track = hits.find(h => h.audio) || hits[0];
    if (!track || !track.audio) return false;
    await downloadFile(track.audio, outputPath);
    return true;
  } catch { return false; }
}

// ── FFMPEG VIDEO ASSEMBLY ────────────────────────────────────────────────────

async function assembleVideo(scenes, audioFiles, musicPath, hasMusic, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    const imagePaths = scenes.map(s => s.imagePath);

    // Add each image as input
    imagePaths.forEach(img => cmd.input(img).inputOptions(['-loop 1', '-t 8']));

    // Add each audio narration
    audioFiles.forEach(a => cmd.input(a));

    // Add music if available
    if (hasMusic && fs.existsSync(musicPath) && fs.statSync(musicPath).size > 0) {
      cmd.input(musicPath);
    }

    const totalScenes = scenes.length;
    const audioCount = audioFiles.length;
    const hasM = hasMusic && fs.existsSync(musicPath) && fs.statSync(musicPath).size > 0;

    // Build filtergraph
    let filterLines = [];

    // Scale and Ken Burns effect for each image
    imagePaths.forEach((_, i) => {
      filterLines.push(
        `[${i}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,` +
        `zoompan=z='min(zoom+0.0008,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=200:s=1280x720,` +
        `setsar=1,fps=25[v${i}]`
      );
    });

    // Concatenate all video streams
    const vInputs = imagePaths.map((_, i) => `[v${i}]`).join('');
    filterLines.push(`${vInputs}concat=n=${totalScenes}:v=1:a=0[vout]`);

    // Concatenate all audio narrations
    const aInputs = audioFiles.map((_, i) => `[${totalScenes + i}:a]`).join('');
    filterLines.push(`${aInputs}concat=n=${audioCount}:v=0:a=1[narr]`);

    if (hasM) {
      // Mix narration + music (music at 20% volume)
      filterLines.push(`[narr]volume=1.0[narr_v]`);
      filterLines.push(`[${totalScenes + audioCount}:a]volume=0.2[music_v]`);
      filterLines.push(`[narr_v][music_v]amix=inputs=2:duration=first[aout]`);
    } else {
      filterLines.push(`[narr]volume=1.0[aout]`);
    }

    cmd
      .complexFilter(filterLines.join(';'))
      .outputOptions([
        '-map [vout]', '-map [aout]',
        '-c:v libx264', '-preset fast', '-crf 23',
        '-c:a aac', '-b:a 192k',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-shortest'
      ])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });
}

// ── ROUTES ───────────────────────────────────────────────────────────────────

// Save config keys at runtime
app.post('/api/config', (req, res) => {
  const { key, value, voiceId } = req.body;
  const map = { claude: 'CLAUDE_API_KEY', eleven: 'ELEVENLABS_API_KEY', replicate: 'REPLICATE_API_TOKEN', pixabay: 'PIXABAY_API_KEY' };
  if (map[key] && value) process.env[map[key]] = value;
  if (key === 'eleven' && voiceId) process.env.ELEVENLABS_VOICE_ID = voiceId;
  res.json({ ok: true });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    apis: {
      claude: !!getEnv('CLAUDE_API_KEY'),
      elevenlabs: !!getEnv('ELEVENLABS_API_KEY'),
      replicate: !!getEnv('REPLICATE_API_TOKEN'),
      pixabay: !!getEnv('PIXABAY_API_KEY')
    }
  });
});

// Analyze idea + get music suggestions
app.post('/api/analyze', async (req, res) => {
  const { idea, duracion, tono } = req.body;
  if (!idea) return res.status(400).json({ error: 'Falta la idea' });
  try {
    const raw = await callClaude(
      `Analiza esta idea de video para YouTube y devuelve SOLO este JSON:
{"scoreRetencion":"X%","scoreEngagement":"X%","scoreSEO":"X%","ideaOptimizada":"versión mejorada","sugerencias":[{"tipo":"retencion","titulo":"titulo","texto":"texto"},{"tipo":"engagement","titulo":"titulo","texto":"texto"},{"tipo":"retencion","titulo":"titulo","texto":"texto"},{"tipo":"seo","titulo":"titulo","texto":"texto"},{"tipo":"engagement","titulo":"titulo","texto":"texto"}],"musicaRecomendada":[{"nombre":"nombre","genero":"genero","mood":"mood","tempo":"lento/medio/rapido","porQueElegirla":"razon","tendencia":"alta/media/baja","queryPixabay":"query 2-3 palabras ingles"},{"nombre":"nombre2","genero":"genero","mood":"mood","tempo":"...","porQueElegirla":"...","tendencia":"alta/media/baja","queryPixabay":"query ingles"},{"nombre":"nombre3","genero":"genero","mood":"mood","tempo":"...","porQueElegirla":"...","tendencia":"alta/media/baja","queryPixabay":"query ingles"}]}
Idea: "${idea}" | Duración: ${duracion} | Tono: ${tono}`
    );
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim());

    // Fetch Pixabay previews
    const pixKey = getEnv('PIXABAY_API_KEY');
    if (pixKey) {
      for (const m of data.musicaRecomendada || []) {
        try {
          const r = await axios.get(`https://pixabay.com/api/music/?key=${pixKey}&q=${encodeURIComponent(m.queryPixabay||'background')}&per_page=3`);
          const hits = r.data.hits || [];
          m.preview = hits.find(h => h.audio)?.audio || null;
          m.trackTitle = hits.find(h => h.audio)?.title || null;
        } catch { m.preview = null; }
      }
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate script
app.post('/api/script', async (req, res) => {
  const { idea, duracion, tono, musicaMood } = req.body;
  if (!idea) return res.status(400).json({ error: 'Falta la idea' });
  const durMap = { corto: '2 min, 4 escenas', medio: '4 min, 5 escenas', largo: '8 min, 7 escenas' };
  const tonMap = { educativo: 'educativo con ejemplos', motivacional: 'motivacional', entretenido: 'entretenido', profesional: 'profesional' };
  try {
    const raw = await callClaude(
      `Generá un guión completo para YouTube sobre: "${idea}"
Duración: ${durMap[duracion] || durMap.medio}. Tono: ${tonMap[tono] || 'educativo'}. ${musicaMood ? 'Música: ' + musicaMood : ''}

Devolvé ÚNICAMENTE este JSON:
{"titulo":"string max 60 chars","descripcion":"string 1 oracion","duracion":"X:XX","escenas":[{"tipo":"intro","label":"Introducción","narracion":"2-3 oraciones, empieza con pregunta o dato impactante","promptImagen":"prompt en ingles estilo fotografico"},{"tipo":"scene","label":"Escena 1: nombre","narracion":"texto, termina con gancho","promptImagen":"prompt ingles"},{"tipo":"scene","label":"Escena 2: nombre","narracion":"texto, termina con gancho","promptImagen":"prompt ingles"},{"tipo":"scene","label":"Escena 3: nombre","narracion":"texto","promptImagen":"prompt ingles"},{"tipo":"cta","label":"Cierre","narracion":"cierre motivador y pedido de suscripcion","promptImagen":"prompt ingles"}]}`,
      'Sos un experto en contenido viral para YouTube en español latino. Respondé SOLO con JSON válido sin backticks.',
      2000
    );
    const data = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate full video — SSE stream for progress updates
app.post('/api/generate-video', async (req, res) => {
  const { guion, musicQuery, jobId: clientJobId } = req.body;
  if (!guion || !guion.escenas) return res.status(400).json({ error: 'Falta el guión' });

  const jobId = clientJobId || uuidv4();
  const jobDir = path.join(TMP, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  const escenas = guion.escenas || [];
  const tmpFiles = [];

  try {
    // 1. Generate images
    const imagePaths = [];
    for (let i = 0; i < escenas.length; i++) {
      send('progress', { step: 'imagen', current: i + 1, total: escenas.length, pct: Math.round(((i + 1) / escenas.length) * 30), msg: `Generando imagen ${i + 1} de ${escenas.length}...` });
      const imgPath = path.join(jobDir, `img_${i}.png`);
      await generateImage(escenas[i].promptImagen || 'cinematic landscape', imgPath);
      imagePaths.push(imgPath);
      tmpFiles.push(imgPath);
    }

    // 2. Generate voice per scene
    send('progress', { step: 'voz', pct: 35, msg: 'Generando voz en off...' });
    const audioPaths = [];
    for (let i = 0; i < escenas.length; i++) {
      send('progress', { step: 'voz', current: i + 1, total: escenas.length, pct: 35 + Math.round(((i + 1) / escenas.length) * 25), msg: `Sintetizando voz escena ${i + 1}...` });
      const audioPath = path.join(jobDir, `audio_${i}.mp3`);
      await generateVoice(escenas[i].narracion || '', audioPath);
      audioPaths.push(audioPath);
      tmpFiles.push(audioPath);
    }

    // 3. Get music
    send('progress', { step: 'musica', pct: 62, msg: 'Descargando música de fondo...' });
    const musicPath = path.join(jobDir, 'music.mp3');
    const hasMusic = await getMusic(musicQuery || 'background music motivational', musicPath);
    if (hasMusic) tmpFiles.push(musicPath);

    // 4. Assemble video
    send('progress', { step: 'ensamblado', pct: 70, msg: 'Ensamblando video con FFmpeg...' });
    const outputPath = path.join(OUT, `video_${jobId}.mp4`);
    const scenesWithPaths = escenas.map((e, i) => ({ ...e, imagePath: imagePaths[i] }));
    await assembleVideo(scenesWithPaths, audioPaths, musicPath, hasMusic, outputPath);

    // 5. Done
    send('progress', { step: 'done', pct: 100, msg: '¡Video listo!' });
    send('done', { url: `/api/download/${jobId}`, filename: `${(guion.titulo || 'video').replace(/[^a-z0-9]/gi, '_')}.mp4` });

    // Cleanup tmp
    cleanup(tmpFiles);
    try { fs.rmdirSync(jobDir); } catch {}

  } catch (e) {
    send('error', { msg: e.message });
    cleanup(tmpFiles);
    try { fs.rmdirSync(jobDir, { recursive: true }); } catch {}
  } finally {
    res.end();
  }
});

// Download generated video
app.get('/api/download/:jobId', (req, res) => {
  const file = path.join(OUT, `video_${req.params.jobId}.mp4`);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Video no encontrado' });
  res.download(file, 'video_youtube.mp4', () => {
    try { fs.unlinkSync(file); } catch {}
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI Video Studio corriendo en puerto ${PORT}`));
