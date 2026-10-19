const $ = (id) => document.getElementById(id);
const CHAVE_STORAGE = "app_estoque_financas_v1";
const CHAVE_API = "app_estoque_api_url";

let itens = [];
let idEdicao = null;

const formatarMoeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const hojeISO = () => new Date().toISOString().slice(0, 10);

function carregarLocal() {
  try {
    itens = JSON.parse(localStorage.getItem(CHAVE_STORAGE)) || [];
  } catch {
    itens = [];
  }
}

function salvarLocal() {
  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(itens));
}

function getApiUrl() {
  return localStorage.getItem(CHAVE_API) || "";
}

async function salvarNoSheets(item) {
  const url = getApiUrl();
  if (!url) return;

  await fetch(url, {
    method: "POST",
    mode: "cors",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "save", item })
  });
}

async function deletarNoSheets(id) {
  const url = getApiUrl();
  if (!url) return;

  await fetch(url, {
    method: "POST",
    mode: "cors",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "delete", id })
  });
}

function calcularEstoques() {
  const estoqueProdutos = {};
  const estoqueInsumos = {};

  itens.forEach(item => {
    const nomeItem = (item.descricao || "").trim();
    const nomeInsumo = (item.insumoUsado || "").trim();
    const qtd = Number(item.quantidade) || 1;

    if (item.tipo === "compra_produto" && nomeItem) {
      estoqueProdutos[nomeItem] = (estoqueProdutos[nomeItem] || 0) + qtd;
    } else if (item.tipo === "venda" && nomeItem) {
      estoqueProdutos[nomeItem] = (estoqueProdutos[nomeItem] || 0) - qtd;
    }

    if (item.tipo === "compra_insumo" && nomeItem) {
      estoqueInsumos[nomeItem] = (estoqueInsumos[nomeItem] || 0) + qtd;
    }
    if (item.tipo === "venda" && nomeInsumo && nomeInsumo.toLowerCase() !== "nenhum") {
      estoqueInsumos[nomeInsumo] = (estoqueInsumos[nomeInsumo] || 0) - qtd;
    }
  });

  return { estoqueProdutos, estoqueInsumos };
}

function atualizarSugestoesDatalist() {
  const { estoqueProdutos, estoqueInsumos } = calcularEstoques();
  const dlProd = $("listaSugestoesProdutos");
  const dlIns = $("listaSugestoesInsumos");

  if (dlProd) {
    dlProd.innerHTML = Object.keys(estoqueProdutos).map(p => `<option value="${p}">Saldo: ${estoqueProdutos[p]}</option>`).join("");
  }
  if (dlIns) {
    dlIns.innerHTML = Object.keys(estoqueInsumos).map(i => `<option value="${i}">Saldo: ${estoqueInsumos[i]}</option>`).join("");
  }
}

function navegarPara(pagina) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));

  if (pagina === "dashboard") {
    $("dashboardPage").classList.remove("hidden");
    renderizarDashboard();
  } else if (pagina === "estoque") {
    $("estoquePage").classList.remove("hidden");
    renderizarTelaEstoque();
  } else if (pagina === "form") {
    $("formPage").classList.remove("hidden");
    atualizarSugestoesDatalist();
  } else if (pagina === "list") {
    $("listPage").classList.remove("hidden");
    renderizarListaCompleta();
  } else if (pagina === "settings") {
    $("settingsPage").classList.remove("hidden");
  }

  const btnNav = document.querySelector(`[data-page="${pagina}"]`);
  if (btnNav) btnNav.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ajustarCamposForm() {
  const tipo = $("tipo").value;
  const camposVenda = document.querySelectorAll(".campo-venda");
  const grupoQtd = $("grupoQuantidade");

  if (tipo === "venda") {
    camposVenda.forEach(el => el.style.display = "flex");
    grupoQtd.style.display = "flex";
    $("lblQtd").textContent = "Qtd Vendida (- estoque)";
    $("lblValor").textContent = "Valor Total da Venda (R$)";
    $("lblDescricao").textContent = "Nome do Produto Vendido";
  } else if (tipo === "compra_produto") {
    camposVenda.forEach(el => el.style.display = "none");
    grupoQtd.style.display = "flex";
    $("lblQtd").textContent = "Qtd Comprada (+ estoque)";
    $("lblValor").textContent = "Custo Total Pago (R$)";
    $("lblDescricao").textContent = "Nome do Produto";
  } else if (tipo === "compra_insumo") {
    camposVenda.forEach(el => el.style.display = "none");
    grupoQtd.style.display = "flex";
    $("lblQtd").textContent = "Qtd de Embalagens (+ estoque)";
    $("lblValor").textContent = "Custo Total Pago (R$)";
    $("lblDescricao").textContent = "Nome do Insumo (Ex: Caixa P)";
  } else {
    camposVenda.forEach(el => el.style.display = "none");
    grupoQtd.style.display = "none";
    $("lblValor").textContent = "Valor do Frete Pago (R$)";
    $("lblDescricao").textContent = "Destino / Motoboy";
  }
}

function autoCalcularLucro() {
  if ($("tipo").value !== "venda") return;
  const valor = Number($("valor").value || 0);
  const custoUnit = Number($("custoProduto").value || 0);
  const qtd = Number($("quantidade").value || 1);
  
  if (valor > 0 && custoUnit >= 0 && !$("lucro").dataset.manual) {
    const custoTotal = custoUnit * qtd;
    $("lucro").value = (valor - custoTotal).toFixed(2);
  }
}

function abrirFormulario(tipo = "venda", itemExistente = null) {
  $("meuForm").reset();
  $("msgForm").textContent = "";
  $("data").value = hojeISO();
  $("quantidade").value = "1";
  $("lucro").dataset.manual = "";

  if (itemExistente) {
    idEdicao = itemExistente.id;
    $("tipo").value = itemExistente.tipo;
    $("data").value = itemExistente.data;
    $("descricao").value = itemExistente.descricao;
    $("quantidade").value = itemExistente.quantidade || 1;
    $("valor").value = itemExistente.valor;
    $("custoProduto").value = itemExistente.custoProduto || "";
    $("lucro").value = itemExistente.lucro || "";
    $("insumoUsado").value = itemExistente.insumoUsado || "";
    $("obs").value = itemExistente.obs || "";
    $("formTitulo").textContent = "Editar Lançamento";
  } else {
    idEdicao = null;
    $("tipo").value = tipo;
    $("formTitulo").textContent = "Novo Lançamento";
  }

  ajustarCamposForm();
  navegarPara("form");
}

async function salvarForm(e) {
  e.preventDefault();
  const btn = $("btnSalvar");
  btn.disabled = true;
  btn.textContent = "Gravando...";

  const tipo = $("tipo").value;
  const item = {
    id: idEdicao || String(Date.now()),
    tipo,
    data: $("data").value,
    descricao: $("descricao").value.trim(),
    quantidade: tipo === "frete" ? 1 : Number($("quantidade").value || 1),
    valor: Number($("valor").value || 0),
    custoProduto: tipo === "venda" ? Number($("custoProduto").value || 0) : 0,
    lucro: tipo === "venda" ? Number($("lucro").value || 0) : 0,
    insumoUsado: tipo === "venda" ? $("insumoUsado").value.trim() : "",
    obs: $("obs").value.trim(),
    criadoEm: new Date().toISOString()
  };

  if (idEdicao) {
    const idx = itens.findIndex(i => i.id === idEdicao);
    if (idx !== -1) itens[idx] = item;
  } else {
    itens.unshift(item);
  }

  salvarLocal();

  try {
    await salvarNoSheets(item);
    $("msgForm").textContent = "✓ Salvo com sucesso!";
    $("msgForm").style.color = "var(--green)";
  } catch {
    $("msgForm").textContent = "Salvo no celular (Offline).";
    $("msgForm").style.color = "var(--orange)";
  }

  btn.disabled = false;
  btn.textContent = "Confirmar e Salvar";
  setTimeout(() => navegarPara("dashboard"), 400);
}

// Criação do card visual da transação
function gerarCardHTML(item, comAcoes = false) {
  const configs = {
    venda: { icon: "💰", badgeClass: "badge-venda", prefix: "+" },
    frete: { icon: "🚚", badgeClass: "badge-frete", prefix: "-" },
    compra_produto: { icon: "📥", badgeClass: "badge-compra", prefix: "-" },
    compra_insumo: { icon: "🏷️", badgeClass: "badge-insumo", prefix: "-" }
  }[item.tipo] || { icon: "📄", badgeClass: "badge-compra", prefix: "" };

  const dataFormatada = item.data ? item.data.slice(5).replace("-", "/") : "";

  return `
    <div class="entry-card">
      <div class="entry-left">
        <div class="entry-badge-icon ${configs.badgeClass}">
          ${configs.icon}
        </div>
        <div class="entry-details">
          <div class="entry-title">${item.descricao}</div>
          <div class="entry-meta">
            <span>${dataFormatada}</span>
            <span class="entry-pill">${item.quantidade || 1} un</span>
            ${item.insumoUsado ? `<span class="entry-pill">📦 ${item.insumoUsado}</span>` : ""}
          </div>
        </div>
      </div>
      <div class="entry-right">
        <div class="entry-amount">${configs.prefix} ${formatarMoeda(item.valor)}</div>
        ${item.tipo === 'venda' && item.lucro > 0 ? `<div class="entry-profit">+${formatarMoeda(item.lucro)} lucro</div>` : ""}
        ${comAcoes ? `
          <div class="entry-actions">
            <button class="btn-icon-sm" onclick="editarItem('${item.id}')">✏️</button>
            <button class="btn-icon-sm" onclick="excluirItem('${item.id}')">🗑️</button>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

function renderizarDashboard() {
  const periodo = $("filtroPeriodo").value;
  const hoje = hojeISO();
  let filtrados = itens;

  if (periodo === "hoje") filtrados = itens.filter(i => i.data === hoje);
  if (periodo === "mes") filtrados = itens.filter(i => (i.data || "").slice(0, 7) === hoje.slice(0, 7));

  const vendas = filtrados.filter(i => i.tipo === "venda");
  const fretes = filtrados.filter(i => i.tipo === "frete");
  const compras = filtrados.filter(i => i.tipo === "compra_produto" || i.tipo === "compra_insumo");

  $("metricaVendas").textContent = formatarMoeda(vendas.reduce((acc, i) => acc + i.valor, 0));
  $("metricaLucro").textContent = formatarMoeda(vendas.reduce((acc, i) => acc + i.lucro, 0));
  $("metricaFretes").textContent = formatarMoeda(fretes.reduce((acc, i) => acc + i.valor, 0));
  $("metricaCompras").textContent = formatarMoeda(compras.reduce((acc, i) => acc + i.valor, 0));

  const recentes = filtrados.slice(0, 5);
  $("listaRecentes").innerHTML = recentes.length 
    ? recentes.map(i => gerarCardHTML(i, false)).join("")
    : `<div class="empty-state">Nenhum lançamento no período.</div>`;
}

function renderizarTelaEstoque() {
  const { estoqueProdutos, estoqueInsumos } = calcularEstoques();

  $("listaEstoqueProdutos").innerHTML = Object.keys(estoqueProdutos).length ? Object.entries(estoqueProdutos).map(([nome, saldo]) => `
    <div class="stock-card">
      <div class="stock-name">📦 ${nome}</div>
      <div class="stock-count ${saldo <= 2 ? 'low' : 'ok'}">${saldo} un</div>
    </div>
  `).join("") : `<div class="empty-state">Nenhum produto cadastrado.</div>`;

  $("listaEstoqueInsumos").innerHTML = Object.keys(estoqueInsumos).length ? Object.entries(estoqueInsumos).map(([nome, saldo]) => `
    <div class="stock-card">
      <div class="stock-name">🏷️ ${nome}</div>
      <div class="stock-count ${saldo <= 5 ? 'low' : 'ok'}">${saldo} un</div>
    </div>
  `).join("") : `<div class="empty-state">Nenhum insumo cadastrado.</div>`;
}

function renderizarListaCompleta() {
  const busca = ($("buscaLista")?.value || "").toLowerCase();
  const lista = itens.filter(i => (i.descricao || "").toLowerCase().includes(busca));

  $("listaExtrato").innerHTML = lista.length
    ? lista.map(i => gerarCardHTML(i, true)).join("")
    : `<div class="empty-state">Nenhum resultado encontrado.</div>`;
}

window.editarItem = (id) => {
  const item = itens.find(i => i.id === id);
  if (item) abrirFormulario(item.tipo, item);
};

window.excluirItem = async (id) => {
  if (!confirm("Excluir este lançamento?")) return;
  itens = itens.filter(i => i.id !== id);
  salvarLocal();
  renderizarListaCompleta();
  renderizarDashboard();
  renderizarTelaEstoque();
  await deletarNoSheets(id);
};

document.addEventListener("DOMContentLoaded", () => {
  carregarLocal();

  document.querySelectorAll(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => navegarPara(btn.dataset.page));
  });

  document.querySelectorAll(".action-card").forEach(btn => {
    btn.addEventListener("click", () => abrirFormulario(btn.dataset.tipo));
  });

  $("btnVoltar")?.addEventListener("click", () => navegarPara("dashboard"));
  $("btnVerTodos")?.addEventListener("click", () => navegarPara("list"));

  $("tipo").addEventListener("change", ajustarCamposForm);
  $("valor").addEventListener("input", autoCalcularLucro);
  $("custoProduto").addEventListener("input", autoCalcularLucro);
  $("quantidade").addEventListener("input", autoCalcularLucro);

  $("lucro").addEventListener("input", () => {
    $("lucro").dataset.manual = "true";
  });

  $("filtroPeriodo").addEventListener("change", renderizarDashboard);
  $("buscaLista")?.addEventListener("input", renderizarListaCompleta);

  $("meuForm").addEventListener("submit", salvarForm);

  $("apiUrl").value = getApiUrl();
  $("btnSalvarConfig").addEventListener("click", () => {
    localStorage.setItem(CHAVE_API, $("apiUrl").value.trim());
    $("msgConfig").textContent = "✓ Conexão salva com sucesso!";
    setTimeout(() => $("msgConfig").textContent = "", 2000);
  });

  $("btnSincronizar").addEventListener("click", async () => {
    const url = getApiUrl();
    if (!url) return alert("Cole a URL da planilha primeiro!");
    $("msgConfig").textContent = "Baixando da planilha...";
    try {
      const res = await fetch(url, { redirect: "follow" }).then(r => r.json());
      if (res.success && res.lancamentos) {
        itens = res.lancamentos;
        salvarLocal();
        $("msgConfig").textContent = `✓ ${itens.length} registros baixados!`;
        renderizarDashboard();
        renderizarTelaEstoque();
      }
    } catch {
      $("msgConfig").textContent = "Erro ao puxar da planilha.";
    }
  });

  navegarPara("dashboard");
});