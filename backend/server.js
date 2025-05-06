const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3001;

 // Mock banco de dados em memória
let temas = [
  { id: 1, titulo: "Integração com WhatsApp", votos: 10, status: "Sugestão" },
  { id: 2, titulo: "Banco de dados para iniciantes", votos: 7, status: "Sugestão" },
  { id: 3, titulo: "Como usar IA no dia a dia", votos: 15, status: "Sugestão" }
];

// Controle de votos e sugestões por IP/cookie
const votosPorIp = {};
const sugestoesPorIp = {};

const LIMITE_SUGESTOES = 3;
const LIMITE_VOTOS = 5;

app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

 // Listar temas
app.get('/api/temas', (req, res) => {
  // Ordenar por mais votados
  const ordenados = [...temas].sort((a, b) => b.votos - a.votos);
  res.json(ordenados);
});

 // Sugerir novo tema
app.post('/api/sugerir', (req, res) => {
  const ip = req.ip;
  const { titulo, descricao } = req.body;
  if (!titulo || typeof titulo !== 'string' || !titulo.trim()) {
    return res.status(400).json({ erro: 'Título inválido.' });
  }
  // Limite por IP
  sugestoesPorIp[ip] = sugestoesPorIp[ip] || [];
  if (sugestoesPorIp[ip].length >= LIMITE_SUGESTOES) {
    return res.status(429).json({ erro: 'Limite de sugestões atingido.' });
  }
  // Verificar similares
  const similares = temas.filter(t => t.titulo.toLowerCase().includes(titulo.toLowerCase()));
  if (similares.length > 0) {
    return res.status(409).json({ erro: 'Tema similar já existe.', similares });
  }
  // Adicionar tema
  const novoTema = {
    id: Date.now(),
    titulo: titulo.trim(),
    descricao: descricao ? descricao.trim() : "",
    votos: 0,
    status: "Sugestão"
  };
  temas.push(novoTema);
  sugestoesPorIp[ip].push(Date.now());
  res.json(novoTema);
});

// Votar em tema
app.post('/api/votar', (req, res) => {
  const ip = req.ip;
  const { id } = req.body;
  if (typeof id !== 'number') {
    return res.status(400).json({ erro: 'ID inválido.' });
  }
  votosPorIp[ip] = votosPorIp[ip] || [];
  if (votosPorIp[ip].length >= LIMITE_VOTOS) {
    return res.status(429).json({ erro: 'Limite de votos atingido.' });
  }
  const tema = temas.find(t => t.id === id);
  if (!tema) {
    return res.status(404).json({ erro: 'Tema não encontrado.' });
  }
  tema.votos++;
  votosPorIp[ip].push(Date.now());
  res.json({ sucesso: true, votos: tema.votos });
});

// Buscar temas similares
app.get('/api/similares', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const similares = temas.filter(t => t.titulo.toLowerCase().includes(q.toLowerCase()));
  res.json(similares);
});

// Filtros (mais votados, recentes, status)
app.get('/api/temas/filtrar', (req, res) => {
  const { filtro } = req.query;
  let filtrados = [...temas];
  if (filtro === 'mais_votados') {
    filtrados.sort((a, b) => b.votos - a.votos);
  } else if (filtro === 'mais_recentes') {
    filtrados.sort((a, b) => b.id - a.id);
  } else if (filtro === 'respondidos') {
    filtrados = filtrados.filter(t => t.status === "Publicado");
  } else if (filtro === 'em_breve') {
    filtrados = filtrados.filter(t => t.status === "Em breve");
  }
  res.json(filtrados);
});

const ADMIN_SECRET = "minha-senha-super-secreta";
const ADMIN_TOKEN = "admin-token-123"; // Token simples para exemplo

// Novo endpoint de login admin (retorna token)
app.post('/api/admin/login', (req, res) => {
  const { senha } = req.body;
  if (senha === ADMIN_SECRET) {
    return res.json({ token: ADMIN_TOKEN });
  }
  return res.status(401).json({ erro: "Senha incorreta." });
});

// Middleware para proteger rotas de admin (agora aceita token via header)
function requireAdmin(req, res, next) {
  // Aceita token via header Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader === `Bearer ${ADMIN_TOKEN}`) {
    return next();
  }
  return res.status(403).json({ erro: "Acesso restrito ao administrador." });
}

// Editar tema (apenas admin)
app.put('/api/temas/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { titulo, descricao } = req.body;
  const tema = temas.find(t => t.id === id);
  if (!tema) {
    return res.status(404).json({ erro: 'Tema não encontrado.' });
  }
  if (titulo && typeof titulo === 'string' && titulo.trim()) {
    tema.titulo = titulo.trim();
  }
  if (typeof descricao === 'string') {
    tema.descricao = descricao.trim();
  }
  res.json(tema);
});

// Deletar tema (apenas admin)
app.delete('/api/temas/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const idx = temas.findIndex(t => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ erro: 'Tema não encontrado.' });
  }
  temas.splice(idx, 1);
  res.json({ sucesso: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
