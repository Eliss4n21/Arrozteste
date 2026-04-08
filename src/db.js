'use strict';
const fs   = require('fs');
const path = require('path');

// No Railway (/tmp é gravável); localmente usa data/db.json
const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/arrozmarket_db.json'
  : path.join(__dirname, '../data/db.json');

if (process.env.NODE_ENV !== 'production') {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/* ── Senha hash de "admin123" gerada com bcrypt salt=10 ── */
const ADMIN_HASH = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi';

const DEFAULT = {
  usuarios: [{
    id: 1, nome: 'Fábio Toledo', email: 'fabio@arrozmarket.com.br',
    senha: ADMIN_HASH, role: 'admin', avatar: 'FT',
    criadoEm: '2025-01-01T00:00:00Z', ativo: true
  }],
  videos: [
    { id:1, titulo:'Safra 2025 e Impactos nos Preços',         data:'07/04/2025', dur:'12:48', url:'', cat:'Análise Diária', status:'pub', views:3400, likes:1247 },
    { id:2, titulo:'Impacto do clima na safra do RS',           data:'03/04/2025', dur:'09:32', url:'', cat:'Análise Diária', status:'pub', views:2100, likes:87   },
    { id:3, titulo:'Parboilizado em alta: por que sobe?',       data:'02/04/2025', dur:'14:05', url:'', cat:'Cotações',      status:'pub', views:3800, likes:214  },
    { id:4, titulo:'Abertura de abril: o que esperar',          data:'01/04/2025', dur:'11:18', url:'', cat:'Análise Diária', status:'pub', views:4200, likes:198  },
    { id:5, titulo:'Fechamento de março e balanço trimestral',  data:'31/03/2025', dur:'18:44', url:'', cat:'Especial',      status:'pub', views:5600, likes:312  },
    { id:6, titulo:'Arroz integral: demanda aquecida',          data:'28/03/2025', dur:'08:55', url:'', cat:'Cotações',      status:'pub', views:2900, likes:105  },
    { id:7, titulo:'Dólar e exportações — reflexo no preço',    data:'27/03/2025', dur:'13:22', url:'', cat:'Técnico',       status:'pub', views:3300, likes:143  },
    { id:8, titulo:'Colheita RS 2025: ritmo e projeções',       data:'25/03/2025', dur:'12:38', url:'', cat:'Análise Diária', status:'pub', views:6100, likes:389  },
  ],
  cotacoes: [
    { id:'cas',   nome:'Em Casca (ESALQ/Senar-RS)',     preco: 65.00, variacao: 0.00, cls:'estavel', unidade:'sc 50kg', fonte:'Cepea/Esalq'        },
    { id:'mf_rs', nome:'Mercado Fisico - Media RS',      preco: 62.00, variacao: 0.00, cls:'estavel', unidade:'sc 50kg', fonte:'Noticias Agricolas'  },
    { id:'agl',   nome:'Agulhinha Irrigado (RS)',        preco: 48.00, variacao: 0.00, cls:'estavel', unidade:'sc 50kg', fonte:'Planeta Arroz'       },
    { id:'lf',    nome:'Longo Fino (MT)',                preco: 60.00, variacao: 0.00, cls:'estavel', unidade:'sc 60kg', fonte:'Planeta Arroz'       },
    { id:'ben',   nome:'Beneficiado Tipo 1 (SP)',        preco:118.00, variacao:-6.35, cls:'baixa',   unidade:'sc 60kg', fonte:'Planeta Arroz'       },
    { id:'parb',  nome:'Parboilizado T1',                preco:155.20, variacao:+2.40, cls:'alta',    unidade:'sc 60kg', fonte:'Estimativa'          },
    { id:'int',   nome:'Integral T1',                    preco:175.80, variacao:+3.10, cls:'alta',    unidade:'sc 60kg', fonte:'Estimativa'          },
    { id:'cat',   nome:'Cateto T1',                      preco: 95.00, variacao:-0.50, cls:'baixa',   unidade:'sc 60kg', fonte:'Estimativa'          },
    { id:'qui',   nome:'Quirera',                        preco: 38.50, variacao:-0.30, cls:'baixa',   unidade:'sc 60kg', fonte:'Estimativa'          },
  ],
  curtidas:  {},   // "userId_videoId": true
  config:    { siteTitulo:'ArrozMarket', corDestaque:'#C8A84B', tickerAtivo:true, proximoId:9 }
};

function lerDB()   { try { if (fs.existsSync(DB_PATH)) return JSON.parse(fs.readFileSync(DB_PATH,'utf8')); } catch {} return JSON.parse(JSON.stringify(DEFAULT)); }
function salvarDB(d){ try { fs.writeFileSync(DB_PATH, JSON.stringify(d,null,2)); } catch {} }

let _db = lerDB();
if (!_db.usuarios?.length) { _db = JSON.parse(JSON.stringify(DEFAULT)); salvarDB(_db); }

const db = {
  /* --- Genérico --- */
  get()  { return _db; },
  save() { salvarDB(_db); },

  /* --- Vídeos --- */
  getVideos()    { return _db.videos.filter(v=>v.status==='pub'); },
  getAllVideos()  { return _db.videos; },
  addVideo(v)    { _db.videos.unshift(v); salvarDB(_db); return v; },
  updateVideo(id,data){ const i=_db.videos.findIndex(v=>v.id===id); if(i<0)return null; _db.videos[i]={..._db.videos[i],...data}; salvarDB(_db); return _db.videos[i]; },
  deleteVideo(id){ _db.videos=_db.videos.filter(v=>v.id!==id); salvarDB(_db); },

  /* --- Cotações --- */
  getCotacoes()     { return _db.cotacoes; },
  updateCotacoes(l) { _db.cotacoes=l; _db.cotacoes.forEach(c=>{c.ts=Date.now();}); salvarDB(_db); },

  /* --- Usuários --- */
  getUsers()       { return _db.usuarios; },
  findUser(email)  { return _db.usuarios.find(u=>u.email===email?.toLowerCase().trim()); },
  findById(id)     { return _db.usuarios.find(u=>u.id===id); },
  addUser(u)       { _db.usuarios.push(u); salvarDB(_db); return u; },
  updateUser(id,data){ const i=_db.usuarios.findIndex(u=>u.id===id); if(i<0)return null; _db.usuarios[i]={..._db.usuarios[i],...data}; salvarDB(_db); return _db.usuarios[i]; },
  setRole(id,role) { return db.updateUser(id,{role}); },

  /* --- Curtidas --- */
  toggleCurtida(uid,vid){
    const k=`${uid}_${vid}`, curtido=!_db.curtidas[k];
    _db.curtidas[k]=curtido;
    const i=_db.videos.findIndex(v=>v.id===vid);
    if(i>=0) _db.videos[i].likes=Math.max(0,(_db.videos[i].likes||0)+(curtido?1:-1));
    salvarDB(_db);
    return {curtido, likes: i>=0?_db.videos[i].likes:0};
  },
  getCurtida(uid,vid){ return !!_db.curtidas[`${uid}_${vid}`]; },

  /* --- Config --- */
  getConfig()       { return _db.config; },
  updateConfig(data){ _db.config={..._db.config,...data}; salvarDB(_db); return _db.config; },
  nextId()          { return ++_db.config.proximoId; },
};

module.exports = db;
