/**
 * Lógica principal do frontend da plataforma de votação
 * Atualizado: agora usa backend local (localhost:3001) que conecta ao Supabase.
 */
const BASE_URL = "https://votacaoconectabv.onrender.com";

document.addEventListener('DOMContentLoaded', () => {
  // Elementos principais
  const sugestaoForm = document.getElementById('sugestao-form');
  const temaInput = document.getElementById('tema-input');
  const descricaoInput = document.getElementById('descricao-input');
  const sugestoesSimilares = document.getElementById('sugestoes-similares');
  const limiteSugestoesInfo = document.getElementById('limite-sugestoes-info');
  const listaTemas = document.getElementById('lista-temas');

  // Estado local (será substituído por integração com backend) 
  let temas = [];
  let sugestoesFeitas = 0;
  const LIMITE_SUGESTOES = 3;
  const LIMITE_VOTOS = 5;
  let votosFeitos = 0;
  let adminToken = null; // Novo: token de admin

  // Carregar temas do backend
  async function carregarTemas() {
    try {
      const resp = await fetch(`${BASE_URL}/api/temas`, { credentials: 'include' });
      temas = await resp.json();
      renderizarTemas();
    } catch (err) {
      listaTemas.innerHTML = "<li>Erro ao carregar temas.</li>";
    }
  }

  // Renderizar lista de temas
  function renderizarTemas() {
    listaTemas.innerHTML = "";
    // Ordenar por mais votados antes de renderizar
    const temasOrdenados = [...temas].sort((a, b) => b.votos - a.votos);
    const isAdmin = !!adminToken;
    temasOrdenados.forEach(tema => {
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="tema-titulo">${tema.titulo}</div>
        <div class="tema-descricao">${tema.descricao ? tema.descricao : ""}</div>
        <button class="upvote-bar" data-id="${tema.id}">
          <span class="upvote-emoji">👍</span>
          <span class="upvote-num">${tema.votos}</span>
        </button>
        ${isAdmin ? `
        <div class="tema-actions">
          <button class="edit-btn" data-id="${tema.id}">Editar</button>
          <button class="delete-btn" data-id="${tema.id}">Excluir</button>
        </div>
        ` : ""}
      `;
      listaTemas.appendChild(li);
    });
  }

  // Sugestão de tema
  sugestaoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (sugestoesFeitas >= LIMITE_SUGESTOES) {
      alert("Você atingiu o limite de sugestões esta semana.");
      return;
    }
    const novoTema = temaInput.value.trim();
    if (!novoTema) return;
    const novaDescricao = descricaoInput.value.trim();

    // Buscar temas similares do backend
    sugestoesSimilares.innerHTML = "Buscando temas similares...";
    try {
      const respSimilares = await fetch(`${BASE_URL}/api/similares?q=${encodeURIComponent(novoTema)}`, { credentials: 'include' });
      const similares = await respSimilares.json();
      if (similares.length > 0) {
        sugestoesSimilares.innerHTML = "<strong>Temas similares já cadastrados:</strong><ul>" +
          similares.map(s => `<li>${s.titulo}</li>`).join("") + "</ul>";
        return;
      } else {
        sugestoesSimilares.innerHTML = "";
      }
    } catch (err) {
      sugestoesSimilares.innerHTML = "<span style='color:red'>Erro ao buscar similares.</span>";
      return;
    }

    // Enviar sugestão para backend
    try {
      const resp = await fetch(`${BASE_URL}/api/sugerir`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ titulo: novoTema, descricao: novaDescricao })
      });
      if (!resp.ok) {
        const erro = await resp.json();
        if (erro.similares && erro.similares.length > 0) {
          sugestoesSimilares.innerHTML = "<strong>Temas similares já cadastrados:</strong><ul>" +
            erro.similares.map(s => `<li>${s.titulo}</li>`).join("") + "</ul>";
        } else {
          alert(erro.erro || "Erro ao sugerir tema.");
        }
        return;
      }
      sugestoesFeitas++;
      temaInput.value = "";
      descricaoInput.value = "";
      await carregarTemas();
      atualizarLimiteSugestoes();
    } catch (err) {
      alert("Erro ao sugerir tema.");
    }
  });

  // Atualizar info de limite de sugestões
  function atualizarLimiteSugestoes() {
    limiteSugestoesInfo.textContent = `Sugestões restantes esta semana: ${LIMITE_SUGESTOES - sugestoesFeitas}`;
  }

  // Votação, exclusão e edição
  listaTemas.addEventListener('click', async (e) => {
    // Votação
    if (e.target.classList.contains('upvote-bar')) {
      if (votosFeitos >= LIMITE_VOTOS) {
        alert("Você atingiu o limite de votos esta semana.");
        return;
      }
      const id = Number(e.target.dataset.id);
      try {
        const resp = await fetch(`${BASE_URL}/api/votar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id })
        });
        if (!resp.ok) {
          const erro = await resp.json();
          alert(erro.erro || "Erro ao votar.");
          return;
        }
        votosFeitos++;
        await carregarTemas();
      } catch (err) {
        alert("Erro ao votar.");
      }
      return;
    }

    // Exclusão
    if (e.target.classList.contains('delete-btn')) {
      const id = Number(e.target.dataset.id);
      if (confirm("Tem certeza que deseja excluir esta sugestão?")) {
        try {
          const resp = await fetch(`${BASE_URL}/api/temas/${id}`, {
            method: 'DELETE',
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
            credentials: 'include'
          });
          if (!resp.ok) {
            alert("Erro ao excluir sugestão.");
            return;
          }
          await carregarTemas();
        } catch (err) {
          alert("Erro ao excluir sugestão.");
        }
      }
      return;
    }

    // Edição
    if (e.target.classList.contains('edit-btn')) {
      const id = Number(e.target.dataset.id);
      const li = e.target.closest('li');
      const tema = temas.find(t => t.id === id);
      if (!li || !tema) return;

      // Substitui o conteúdo do card por um formulário de edição
      li.innerHTML = `
        <input class="edit-titulo" type="text" value="${tema.titulo.replace(/"/g, '"')}" style="margin-bottom:0.7rem; width:100%; padding:0.7rem 1rem; border-radius:10px; border:1.5px solid #2d2f4a; background:#23243a; color:#e2e6f3; font-size:1rem;">
        <textarea class="edit-descricao" rows="3" style="width:100%; padding:0.7rem 1rem; border-radius:10px; border:1.5px solid #2d2f4a; background:#23243a; color:#e2e6f3; font-size:1rem; margin-bottom:0.7rem; resize:vertical;">${tema.descricao ? tema.descricao : ""}</textarea>
        <div class="tema-actions">
          <button class="save-edit-btn" data-id="${id}">Salvar</button>
          <button class="cancel-edit-btn" data-id="${id}">Cancelar</button>
        </div>
      `;
      return;
    }

    // Salvar edição
    if (e.target.classList.contains('save-edit-btn')) {
      const id = Number(e.target.dataset.id);
      const li = e.target.closest('li');
      if (!li) return;
      const novoTitulo = li.querySelector('.edit-titulo').value.trim();
      const novaDescricao = li.querySelector('.edit-descricao').value.trim();
      if (!novoTitulo) {
        alert("O título não pode ser vazio.");
        return;
      }
      try {
        fetch(`${BASE_URL}/api/temas/${id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {})
          },
          credentials: 'include',
          body: JSON.stringify({ titulo: novoTitulo, descricao: novaDescricao })
        }).then(async resp => {
          if (!resp.ok) {
            alert("Erro ao salvar edição.");
            return;
          }
          await carregarTemas();
        });
      } catch (err) {
        alert("Erro ao salvar edição.");
      }
      return;
    }

    // Cancelar edição
    if (e.target.classList.contains('cancel-edit-btn')) {
      await carregarTemas();
      return;
    }
  });

  // (Filtro removido: sempre mostra mais votados)

  // Admin login/logout
  function updateAdminUI() {
    const isAdmin = !!adminToken;
    document.getElementById("admin-status").textContent = isAdmin ? "Modo admin ativo" : "";
    document.getElementById("admin-login-btn").style.display = isAdmin ? "none" : "";
    document.getElementById("admin-logout-btn").style.display = isAdmin ? "" : "none";
    document.getElementById("admin-password").style.display = isAdmin ? "none" : "";
    renderizarTemas();
  }

  document.getElementById("admin-login-btn").addEventListener("click", async (e) => {
    e.preventDefault();
    const pwd = document.getElementById("admin-password").value;
    try {
      const resp = await fetch(`${BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha: pwd })
      });
      if (!resp.ok) {
        alert("Senha incorreta.");
        return;
      }
      const data = await resp.json();
      adminToken = data.token;
      document.getElementById("admin-password").value = "";
      updateAdminUI();
    } catch (err) {
      alert("Erro ao fazer login admin.");
    }
  });

  document.getElementById("admin-logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    adminToken = null;
    document.getElementById("admin-password").value = "";
    updateAdminUI();
  });

  // Inicialização
  carregarTemas();
  atualizarLimiteSugestoes();
  updateAdminUI();
});
