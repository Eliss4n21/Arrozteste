'use strict';
/**
 * routes/api.js — Todas as rotas REST
 *
 * PÚBLICAS:
 *   GET  /api/cotacoes
 *   GET  /api/videos
 *   POST /api/auth/login
 *   POST /api/auth/registro
 *
 * AUTENTICADAS (Bearer token):
 *   GET  /api/me
 *   PUT  /api/me
 *   POST /api/videos/:id/curtir
 *   GET  /api/videos/:id/curtida
 *
 * ADMIN ONLY:
 *   GET/POST        /api/admin/videos
 *   PUT/DELETE      /api/admin/videos/:id
 *   PUT             /api/admin/cotacoes
 *   GET             /api/admin/usuarios
 *   PUT             /api/admin/usuarios/:id/role
 *   GET/PUT         /api/admin/config
 *   POST            /api/admin/scrape
 */

const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../src/db');
const { autenticar, soAdmin } = require('../middleware/auth');
const { scrapeCEPEA }         = require('../src/scraper');

const SEC = () => process.env.JWT_SECRET || 'dev-secret-change-me';
const EXP = () => process.env.JWT_EXPIRES || '7d';

function gerarToken(u) { return jwt.sign({ id:u.id, role:u.role }, SEC(), { expiresIn:EXP() }); }

/* ═══ PÚBLICAS ═══════════════════════════════════════════════════════ */

router.get('/cotacoes', (_, res) => res.json(db.getCotacoes()));

router.get('/videos',   (_, res) => res.json(db.getVideos()));

router.post('/auth/registro', async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro:'Preencha todos os campos.' });
  if (senha.length < 6)          return res.status(400).json({ erro:'Senha deve ter ao menos 6 caracteres.' });
  if (db.findUser(email))        return res.status(409).json({ erro:'E-mail já cadastrado.' });

  const inits = nome.trim().split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  const novo  = {
    id: Date.now(), nome: nome.trim(), email: email.toLowerCase().trim(),
    senha: await bcrypt.hash(senha, 10), role:'user',
    avatar: inits, criadoEm: new Date().toISOString(), ativo:true
  };
  db.addUser(novo);
  const { senha:_, ...sem } = novo;
  res.status(201).json({ usuario:sem, token:gerarToken(novo) });
});

router.post('/auth/login', async (req, res) => {
  const { email, senha } = req.body;
  const u = db.findUser(email);
  if (!u || !u.ativo) return res.status(401).json({ erro:'Credenciais inválidas.' });
  if (!await bcrypt.compare(senha, u.senha)) return res.status(401).json({ erro:'Credenciais inválidas.' });
  const { senha:_, ...sem } = u;
  res.json({ usuario:sem, token:gerarToken(u) });
});

/* ═══ AUTENTICADAS ═══════════════════════════════════════════════════ */

router.get('/me', autenticar, (req, res) => {
  const { senha, ...sem } = req.user; res.json(sem);
});

router.put('/me', autenticar, async (req, res) => {
  const { nome, senhaAtual, senhaNova } = req.body;
  const upd = {};
  if (nome) upd.nome = nome.trim();
  if (senhaNova) {
    if (!senhaAtual) return res.status(400).json({ erro:'Informe a senha atual.' });
    if (!await bcrypt.compare(senhaAtual, req.user.senha)) return res.status(400).json({ erro:'Senha atual incorreta.' });
    if (senhaNova.length < 6) return res.status(400).json({ erro:'Nova senha muito curta.' });
    upd.senha = await bcrypt.hash(senhaNova, 10);
  }
  const at = db.updateUser(req.user.id, upd);
  const { senha:_, ...sem } = at;
  res.json(sem);
});

router.post('/videos/:id/curtir', autenticar, (req, res) => {
  res.json(db.toggleCurtida(req.user.id, parseInt(req.params.id)));
});

router.get('/videos/:id/curtida', autenticar, (req, res) => {
  res.json({ curtido: db.getCurtida(req.user.id, parseInt(req.params.id)) });
});

/* ═══ ADMIN ══════════════════════════════════════════════════════════ */

router.get('/admin/videos',    autenticar, soAdmin, (_, res) => res.json(db.getAllVideos()));

router.post('/admin/videos',   autenticar, soAdmin, (req, res) => {
  const { titulo, data, dur, url, cat, status, desc } = req.body;
  if (!titulo || !data) return res.status(400).json({ erro:'Título e data obrigatórios.' });
  res.status(201).json(db.addVideo({ id:db.nextId(), titulo, data, dur:dur||'00:00', url:url||'', cat:cat||'Análise Diária', status:status||'pub', desc:desc||'', views:0, likes:0 }));
});

router.put('/admin/videos/:id', autenticar, soAdmin, (req, res) => {
  const v = db.updateVideo(parseInt(req.params.id), req.body);
  if (!v) return res.status(404).json({ erro:'Vídeo não encontrado.' });
  res.json(v);
});

router.delete('/admin/videos/:id', autenticar, soAdmin, (req, res) => {
  db.deleteVideo(parseInt(req.params.id)); res.json({ ok:true });
});

router.put('/admin/cotacoes', autenticar, soAdmin, (req, res) => {
  const { cotacoes } = req.body;
  if (!Array.isArray(cotacoes)) return res.status(400).json({ erro:'Formato inválido.' });
  db.updateCotacoes(cotacoes); res.json(db.getCotacoes());
});

router.get('/admin/usuarios', autenticar, soAdmin, (_, res) => {
  res.json(db.getUsers().map(({ senha, ...u }) => u));
});

// Conceder/revogar cargo de admin
router.put('/admin/usuarios/:id/role', autenticar, soAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin','user'].includes(role)) return res.status(400).json({ erro:'Cargo inválido.' });
  const at = db.setRole(parseInt(req.params.id), role);
  if (!at) return res.status(404).json({ erro:'Usuário não encontrado.' });
  const { senha, ...sem } = at;
  res.json(sem);
});

router.get('/admin/config', autenticar, soAdmin, (_, res) => res.json(db.getConfig()));

router.put('/admin/config', autenticar, soAdmin, (req, res) => {
  res.json(db.updateConfig(req.body));
});

// Força scraping imediato
router.post('/admin/scrape', autenticar, soAdmin, async (_, res) => {
  try { res.json({ ok:true, cotacoes: await scrapeCEPEA(), ts: Date.now() }); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
