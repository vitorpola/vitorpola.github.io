/**
 * Carnaval de Marchinhas 2026 - São Luiz do Paraitinga
 * Carrega programação, agrupa por dia e implementa busca client-side.
 */

// Mapeamento de datas para labels em português
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/**
 * Formata hora "HH:MM" para exibição vertical "HH\nMM" (ex.: 20:30 -> 20\n30, 22:00 -> 22\n00)
 */
function formatarHora(time) {
  const [h, m] = time.split(":").map(Number);
  const min = (m || 0).toString().padStart(2, "0");
  return `${h}h${min}`;
}

/**
 * Agrupa eventos por data e gera labels de dia.
 * Retorna array de { dia, data, label, eventos } ordenados.
 */
function agruparPorDia(eventos) {
  const porData = {};
  for (const e of eventos) {
    if (!porData[e.date]) porData[e.date] = [];
    porData[e.date].push(e);
  }
  const datas = Object.keys(porData).sort();
  return datas.map((date) => {
    const d = new Date(date + "T12:00:00");
    const diaSemana = DIAS_SEMANA[d.getDay()];
    const mes = MESES[d.getMonth()];
    const diaNum = d.getDate();
    const mesNum = (d.getMonth() + 1).toString().padStart(2, "0");
    const label = `${diaSemana} (${diaNum}/${mesNum})`;
    const eventosDoDia = porData[date].sort((a, b) => a.time.localeCompare(b.time));
    return { dia: date, label, diaSemana, mes, diaNum, eventos: eventosDoDia };
  });
}

/**
 * Verifica se um evento já ocorreu (está no passado em relação ao horário atual).
 * @param {Object} e - Evento com date e time
 * @param {string} hoje - Data atual no formato YYYY-MM-DD
 * @param {Date} agora - Instante atual
 */
function eventoPassou(e, hoje, agora) {
  if (e.date < hoje) return true;
  if (e.date > hoje) return false;
  const dtEvento = new Date(e.date + "T" + e.time);
  return dtEvento < agora;
}

/**
 * Renderiza a agenda no DOM.
 * @param {Array} dias - Array de { dia, label, eventos } retornado por agruparPorDia
 * @param {boolean} mostrarLabelsDia - Exibe o título da data em cada seção (útil na busca)
 */
function render(dias, mostrarLabelsDia = false) {
  const agenda = document.getElementById("agenda");
  if (!dias.length) {
    agenda.innerHTML = '<p class="msg-vazia">Nenhum resultado encontrado.</p>';
    return;
  }
  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${(agora.getMonth() + 1).toString().padStart(2, "0")}-${agora.getDate().toString().padStart(2, "0")}`;
  agenda.innerHTML = dias
    .map(
      (d) => `
    <section data-day="${d.dia}">
      ${mostrarLabelsDia ? `<h2>${d.label}</h2>` : ""}
      ${d.eventos
        .map(
          (e) => {
            const passou = eventoPassou(e, hoje, agora);
            const datetime = e.date + "T" + (e.time || "00:00");
            return `
        <div class="evento ${e.type} ${passou ? "passado" : ""}" data-datetime="${datetime}">
          <div class="evento-conteudo">
            <span class="hora">${formatarHora(e.time)}</span>
            <strong>${e.event_name}</strong>
            ${e.location && e.location !== "Não informado" ? `<small>${e.location}</small>` : ""}
          </div>
        </div>
      `;
          }
        )
        .join("")}
    </section>
  `
    )
    .join("");
}

/**
 * Filtra dias/eventos conforme o termo de busca.
 * Busca em: nome do evento, data (dia, mês, dia da semana).
 */
function filtrar(eventos, termo) {
  const t = termo.trim().toLowerCase();
  if (!t) return eventos;

  return eventos.filter((e) => {
    const nome = e.event_name.toLowerCase();
    const local = (e.location || "").toLowerCase();
    const data = new Date(e.date + "T12:00:00");
    const diaSemana = DIAS_SEMANA[data.getDay()].toLowerCase();
    const mes = MESES[data.getMonth()].toLowerCase();
    const diaNum = data.getDate().toString();

    return (
      nome.includes(t) ||
      local.includes(t) ||
      diaSemana.includes(t) ||
      mes.includes(t) ||
      diaNum.includes(t)
    );
  });
}

// Estado global: programação original e dia selecionado
let todosEventos = [];
let diaSelecionado = null; // Será definido ao carregar (dia atual ou primeiro dia)

/**
 * Atualiza a classe "passado" nos eventos conforme o horário atual.
 * Chamada periodicamente para refletir eventos que passaram com o tempo.
 */
function atualizarEventosPassados() {
  const agora = new Date();
  document.querySelectorAll("#agenda .evento[data-datetime]").forEach((el) => {
    const dt = new Date(el.dataset.datetime);
    const passou = dt < agora;
    el.classList.toggle("passado", passou);
  });
}

/**
 * Mostra/oculta seções conforme o dia selecionado.
 * Quando há busca ativa, mostra todos os dias (resultados da pesquisa).
 */
function aplicarFiltroDia() {
  const sections = document.querySelectorAll("#agenda section[data-day]");
  const termoBusca = (document.getElementById("search")?.value || "").trim();
  const emBusca = termoBusca.length > 0;

  sections.forEach((s) => {
    if (emBusca) {
      s.classList.remove("section-hidden");
    } else {
      s.classList.toggle("section-hidden", s.dataset.day !== diaSelecionado);
    }
  });
}

/**
 * Atualiza o estado dos tabs e aplica o filtro de dia.
 */
function selecionarDia(dia) {
  diaSelecionado = dia;
  const tabs = document.querySelectorAll("#day-tabs button[role='tab']");
  tabs.forEach((btn) => {
    btn.setAttribute("aria-selected", btn.dataset.day === dia ? "true" : "false");
  });
  aplicarFiltroDia();
}

fetch("data/programacao.json")
  .then((res) => res.json())
  .then((data) => {
    todosEventos = data;
    const dias = agruparPorDia(data);
    const datasDisponiveis = dias.map((d) => d.dia);
    const params = new URLSearchParams(window.location.search);
    const diaUrl = params.get("dia");
    let hoje;
    if (diaUrl && datasDisponiveis.includes(diaUrl)) {
      diaSelecionado = diaUrl;
    } else {
      const now = new Date();
      hoje = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}-${now.getDate().toString().padStart(2, "0")}`;
      diaSelecionado = datasDisponiveis.includes(hoje) ? hoje : dias[0].dia;
    }
    render(dias);
    selecionarDia(diaSelecionado);

    // Atualiza eventos passados a cada minuto (ex.: 20:00 vira "passado" após o horário)
    setInterval(atualizarEventosPassados, 60000);

    // Tabs: navegação por dia
    document.querySelectorAll("#day-tabs button[role='tab']").forEach((btn) => {
      btn.addEventListener("click", () => selecionarDia(btn.dataset.day));
    });
  })
  .catch((err) => {
    document.getElementById("agenda").innerHTML =
      '<p class="msg-vazia">Erro ao carregar a programação.</p>';
    console.error(err);
  });

// Botão lupa: abre o input e foca
const searchBtn = document.getElementById("search-btn");
const searchInput = document.getElementById("search");
const searchWrapper = document.querySelector(".search-wrapper");
if (searchBtn && searchInput && searchWrapper) {
  function abrirBusca() {
    searchWrapper.classList.add("search-open");
    searchBtn.setAttribute("aria-expanded", "true");
    searchBtn.setAttribute("aria-label", "Fechar busca");
    searchInput.focus();
  }

  function fecharBusca() {
    searchWrapper.classList.remove("search-open");
    searchBtn.setAttribute("aria-expanded", "false");
    searchBtn.setAttribute("aria-label", "Abrir busca");
    searchInput.value = "";
    searchInput.blur();
    searchInput.dispatchEvent(new Event("input"));
  }

  searchBtn.addEventListener("click", () => {
    if (searchWrapper.classList.contains("search-open")) {
      fecharBusca();
    } else {
      abrirBusca();
    }
  });

  searchInput.addEventListener("blur", (e) => {
    if (e.relatedTarget === searchBtn) return;
    fecharBusca();
  });
}

// Busca em tempo real
if (searchInput) {
  const aoBuscar = () => {
    const termo = searchInput.value;
    const filtrados = filtrar(todosEventos, termo);
    const dias = agruparPorDia(filtrados);
    const emBusca = termo.trim().length > 0;
    render(dias, emBusca);
    aplicarFiltroDia();
  };
  searchInput.addEventListener("input", aoBuscar);
  searchInput.addEventListener("search", aoBuscar);
}
