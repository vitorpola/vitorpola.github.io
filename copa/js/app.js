/**
 * Layout wireframe: TODAS/FALTANTES/REPETIDAS, pesquisa, carril A–L, painel do grupo.
 */

const STORAGE_KEY = "copa2026-cromos-v1";
const GROUP_LETTERS = "ABCDEFGHIJKL";
/** Índice do grupo “indefinido” # (Introdução, Museu, Coca-Cola como países). */
const HASH_GROUP_INDEX = 12;
const UI_GROUP_KEY = "copa2026-ui-group";

/** @typedef {{ id: number, kind: string, teamId?: string, teamName_pt?: string, slotInTeam?: number, foil?: boolean, label_pt: string }} StickerDef */

/** @param {any} data */
function buildStickers(data) {
  /** @type {StickerDef[]} */
  const list = [];
  const intro = data.structure.intro;
  const teams = data.structure.teams;
  const museum = data.structure.museum;
  const coca = data.structure.cocaCola;
  const teamOrder = data.teamOrder;

  for (let id = intro.from; id <= intro.to; id++) {
    list.push({
      id,
      kind: intro.kind,
      label_pt: `Introdução ${id - intro.from + 1}`,
    });
  }

  let tid = teams.from;
  for (let ti = 0; ti < teamOrder.length; ti++) {
    const t = teamOrder[ti];
    for (let s = 0; s < teams.perTeam; s++) {
      list.push({
        id: tid,
        kind: teams.kind,
        teamId: t.id,
        teamName_pt: t.name_pt,
        slotInTeam: s + 1,
        foil: s === 0,
        label_pt: s === 0 ? `Emblema ${t.name_pt}` : `Cromo ${s + 1} · ${t.name_pt}`,
      });
      tid++;
    }
  }

  for (let id = museum.from; id <= museum.to; id++) {
    list.push({
      id,
      kind: museum.kind,
      label_pt: `Museu FIFA ${id - museum.from + 1}`,
    });
  }

  for (let id = coca.from; id <= coca.to; id++) {
    list.push({
      id,
      kind: coca.kind,
      label_pt: `Coca-Cola ${id - coca.from + 1}`,
    });
  }

  return list;
}

/** @param {{ id: string, name_pt: string }[]} teamOrder */
function chunkTeams(teamOrder, size = 4) {
  const chunks = [];
  for (let i = 0; i < teamOrder.length; i += size) {
    chunks.push(teamOrder.slice(i, i + size));
  }
  return chunks;
}

function loadCounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** @param {Record<string, number>} counts */
function saveCounts(counts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
}

/** @param {number} id */
function getQ(counts, id) {
  const k = String(id);
  const v = counts[k];
  return typeof v === "number" && v >= 0 ? Math.floor(v) : 0;
}

/** @param {StickerDef[]} stickers @param {Record<string, number>} counts */
function computeStats(stickers, counts) {
  let have = 0;
  let missing = 0;
  let dupes = 0;
  for (const s of stickers) {
    const q = getQ(counts, s.id);
    if (q >= 1) have++;
    else missing++;
    dupes += Math.max(0, q - 1);
  }
  return { have, missing, dupes, total: stickers.length };
}

function loadUiState() {
  let idx = 0;
  try {
    const g = sessionStorage.getItem(UI_GROUP_KEY);
    if (g != null) {
      const n = parseInt(g, 10);
      if (!Number.isNaN(n)) idx = Math.min(HASH_GROUP_INDEX, Math.max(0, n));
    }
  } catch {
    /* ignore */
  }
  return idx;
}

function saveUiState(groupIndex) {
  try {
    sessionStorage.setItem(UI_GROUP_KEY, String(groupIndex));
  } catch {
    /* ignore */
  }
}

function main() {
  const albumEl = document.getElementById("album");
  const splitEl = document.getElementById("split");
  const railEl = document.getElementById("group-rail");
  const panelScrollEl = document.getElementById("panel-scroll");
  const errEl = document.getElementById("load-error");

  const statHave = document.getElementById("stat-have");
  const statMissing = document.getElementById("stat-missing");
  const statDupes = document.getElementById("stat-dupes");
  const statTotal = document.getElementById("stat-total");

  const segmentBtns = document.querySelectorAll(".segment-btn");
  const countFilterAll = document.getElementById("count-filter-all");
  const countFilterMissing = document.getElementById("count-filter-missing");
  const countFilterDupes = document.getElementById("count-filter-dupes");

  if (!albumEl || !splitEl || !railEl) {
    return;
  }

  /** Grupo destacado no carril (sincronizado com o scroll do painel). */
  let visibleGroupIndex = loadUiState();
  /** @type {AbortController | null} */
  let scrollSpyAbort = null;
  /** @type {'all' | 'missing' | 'dupes'} */
  let filterMode = "all";

  /** @type {StickerDef[]} */
  let stickers = [];
  /** @type {{ id: string, name_pt: string }[]} */
  let teamOrder = [];
  let counts = loadCounts();
  updateStats();

  function updateStats() {
    const st = computeStats(stickers, counts);
    if (statHave) statHave.textContent = String(st.have);
    if (statMissing) statMissing.textContent = String(st.missing);
    if (statDupes) statDupes.textContent = String(st.dupes);
    if (statTotal) statTotal.textContent = String(st.total);
    updateSegmentCounts();
  }

  /** Contadores nas abas: total no álbum, faltas (q=0), tipos com duplicados (q>1). */
  function updateSegmentCounts() {
    if (!countFilterAll || !countFilterMissing || !countFilterDupes) return;

    if (!stickers.length) {
      countFilterAll.textContent = "—";
      countFilterMissing.textContent = "—";
      countFilterDupes.textContent = "—";
      segmentBtns.forEach((btn) => {
        const f = btn.dataset.filter;
        if (f === "all") btn.setAttribute("aria-label", "Todas");
        else if (f === "missing") btn.setAttribute("aria-label", "Faltantes");
        else if (f === "dupes") btn.setAttribute("aria-label", "Repetidas");
      });
      return;
    }

    const total = stickers.length;
    let missing = 0;
    let withDupes = 0;
    for (const s of stickers) {
      const q = getQ(counts, s.id);
      if (q === 0) missing++;
      if (q > 1) withDupes++;
    }

    countFilterAll.textContent = String(total);
    countFilterMissing.textContent = String(missing);
    countFilterDupes.textContent = String(withDupes);

    segmentBtns.forEach((btn) => {
      const f = btn.dataset.filter;
      if (f === "all") btn.setAttribute("aria-label", `Todas, ${total} cromos no álbum`);
      else if (f === "missing") btn.setAttribute("aria-label", `Faltantes, ${missing} cromos`);
      else if (f === "dupes") btn.setAttribute("aria-label", `Repetidas, ${withDupes} cromos com mais de uma cópia`);
    });
  }

  function setQty(id, q) {
    const n = Math.max(0, Math.min(999, Math.floor(q)));
    const k = String(id);
    if (n === 0) delete counts[k];
    else counts[k] = n;
    saveCounts(counts);
    updateStats();
    render();
  }

  /** +1 por entrada (mesmo id repetido = vários +1); uma só renderização. */
  function applyIncrementsForIds(ids) {
    for (const id of ids) {
      const k = String(id);
      const cur = getQ(counts, id);
      counts[k] = Math.min(999, cur + 1);
    }
    saveCounts(counts);
    updateStats();
    render();
  }

  /**
   * Código do verso Panini: três letras + número (ex. ESP 1, FWC 5).
   * FWC 1–9 → intro álbum 1–9; FWC 10–20 → museu 970–980.
   */
  function resolveBackCode(code3, numStr) {
    const c = String(code3).toUpperCase().trim();
    const n = parseInt(String(numStr).trim(), 10);
    if (!stickers.length || Number.isNaN(n)) return null;

    if (c === "FWC") {
      if (n >= 1 && n <= 9) {
        const hit = stickers.find((x) => x.kind === "intro" && x.id === n);
        return hit ? hit.id : null;
      }
      if (n >= 10 && n <= 20) {
        const albumId = 970 + (n - 10);
        const hit = stickers.find((x) => x.kind === "museum" && x.id === albumId);
        return hit ? albumId : null;
      }
      return null;
    }

    const hit = stickers.find((x) => x.kind === "base" && x.teamId === c && x.slotInTeam === n);
    return hit ? hit.id : null;
  }

  function syncSegmentUi() {
    segmentBtns.forEach((btn) => {
      const on = btn.dataset.filter === filterMode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncRailUi() {
    railEl.querySelectorAll(".group-rail-btn").forEach((btn) => {
      const idx = parseInt(btn.dataset.groupIndex ?? "-1", 10);
      const on = idx === visibleGroupIndex;
      btn.classList.toggle("is-active", on);
      if (on) btn.setAttribute("aria-current", "true");
      else btn.removeAttribute("aria-current");
    });
  }

  function disconnectScrollSpy() {
    if (scrollSpyAbort) {
      scrollSpyAbort.abort();
      scrollSpyAbort = null;
    }
  }

  function bindScrollSpy() {
    disconnectScrollSpy();
    const root = panelScrollEl;
    if (!root) return;

    scrollSpyAbort = new AbortController();
    const { signal } = scrollSpyAbort;

    function updateFromScroll() {
      const sections = albumEl.querySelectorAll("[data-group-section]");
      if (!sections.length) return;

      const rr = root.getBoundingClientRect();
      const probeY = rr.top + Math.min(rr.height * 0.22, 96);

      let bestIdx = 0;
      let bestDist = Infinity;
      sections.forEach((sec) => {
        const r = sec.getBoundingClientRect();
        if (r.bottom <= rr.top + 2 || r.top >= rr.bottom - 2) return;
        const mid = (r.top + r.bottom) / 2;
        const d = Math.abs(mid - probeY);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = parseInt(sec.dataset.groupSection ?? "0", 10);
        }
      });

      if (bestIdx !== visibleGroupIndex) {
        visibleGroupIndex = bestIdx;
        syncRailUi();
        saveUiState(visibleGroupIndex);
      }
    }

    let scheduled = false;
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        updateFromScroll();
      });
    };

    root.addEventListener("scroll", onScroll, { passive: true, signal });
    requestAnimationFrame(updateFromScroll);
  }

  /** Filtro global (aba); não filtra por grupo — todos os grupos estão no mesmo painel. */
  /** @param {StickerDef} s */
  function stickerMatchesFilters(s) {
    const q = getQ(counts, s.id);
    if (filterMode === "missing" && q !== 0) return false;
    if (filterMode === "dupes" && q <= 1) return false;
    return true;
  }

  /** @param {StickerDef} s */
  function chipLabel(s) {
    if (typeof s.slotInTeam === "number") return String(s.slotInTeam);
    return String(s.id);
  }

  /** @param {StickerDef} s */
  function createChip(s) {
    const q = getQ(counts, s.id);
    const chip = document.createElement("div");
    chip.className = "chip";
    if (s.foil) chip.classList.add("chip-foil");
    chip.dataset.q = String(q);
    chip.setAttribute("role", "button");
    chip.setAttribute("tabindex", "0");
    chip.title = `Álbum n.º ${s.id}`;
    chip.setAttribute(
      "aria-label",
      `Cromo ${chipLabel(s)}, álbum ${s.id}, quantidade ${q}. Toque duas vezes para adicionar; três vezes para remover. Teclado: setas para ajustar.`,
    );

    const mid = document.createElement("div");
    mid.className = "chip-mid";
    const slotEl = document.createElement("span");
    slotEl.className = "chip-slot";
    slotEl.textContent = chipLabel(s);
    mid.appendChild(slotEl);
    const qtyEl = document.createElement("span");
    qtyEl.className = "chip-qty";
    if (q > 1) qtyEl.textContent = `×${q}`;
    mid.appendChild(qtyEl);

    chip.appendChild(mid);

    /** Solta o dedo/botão em pouco tempo = toque (não arrasto longo). */
    const MAX_TAP_MS = 320;
    /** Máximo entre toques consecutivos na mesma cadeia. */
    const TAP_CHAIN_GAP_MS = 400;
    /** Após o 2.º toque: se não vier o 3.º a tempo, confirma o duplo (+1). */
    const DOUBLE_CONFIRM_MS = 300;

    let downAt = 0;
    let tapChain = 0;
    let lastTapTime = 0;
    let confirmDoubleTimer = 0;

    function clearConfirmDouble() {
      if (confirmDoubleTimer) {
        clearTimeout(confirmDoubleTimer);
        confirmDoubleTimer = 0;
      }
    }

    chip.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      downAt = Date.now();
    });

    chip.addEventListener("pointerup", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const up = Date.now();
      const pressMs = up - downAt;

      if (pressMs > MAX_TAP_MS) {
        clearConfirmDouble();
        tapChain = 0;
        return;
      }

      if (tapChain > 0 && up - lastTapTime > TAP_CHAIN_GAP_MS) {
        clearConfirmDouble();
        tapChain = 0;
      }

      tapChain += 1;
      lastTapTime = up;

      if (tapChain === 3) {
        clearConfirmDouble();
        setQty(s.id, getQ(counts, s.id) - 1);
        tapChain = 0;
        return;
      }

      if (tapChain === 2) {
        clearConfirmDouble();
        confirmDoubleTimer = window.setTimeout(() => {
          confirmDoubleTimer = 0;
          setQty(s.id, getQ(counts, s.id) + 1);
          tapChain = 0;
        }, DOUBLE_CONFIRM_MS);
      }
    });

    chip.addEventListener("pointercancel", () => {
      clearConfirmDouble();
      tapChain = 0;
    });

    chip.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    chip.addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        setQty(s.id, getQ(counts, s.id) + 1);
      }
      if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        setQty(s.id, getQ(counts, s.id) - 1);
      }
    });

    return chip;
  }

  /**
   * Uma raia estilo equipa: cabeçalho Nome (COD) + strip.
   * @param {HTMLElement} groupEl
   * @param {string} teamHeadText ex. "Introdução (INT)"
   * @param {StickerDef[]} items já filtrados por tipo
   * @returns {boolean} true se adicionou cromos visíveis
   */
  function appendTeamLane(groupEl, teamHeadText, items) {
    const visible = items.filter(stickerMatchesFilters);
    if (visible.length === 0) return false;

    const lane = document.createElement("div");
    lane.className = "team-lane";
    const head = document.createElement("div");
    head.className = "team-head";
    head.textContent = teamHeadText;
    lane.appendChild(head);

    const strip = document.createElement("div");
    strip.className = "chip-strip";
    strip.setAttribute("role", "group");
    strip.setAttribute("aria-label", teamHeadText);

    for (const s of visible) {
      strip.appendChild(createChip(s));
    }
    lane.appendChild(strip);
    groupEl.appendChild(lane);
    return true;
  }

  /**
   * @param {number} gi 0..11
   * @returns {HTMLElement}
   */
  function buildLetterGroupSection(gi) {
    const groups = chunkTeams(teamOrder, 4);
    const teamsInGroup = groups[gi];
    const letter = GROUP_LETTERS[gi] ?? "?";

    const anchor = document.createElement("section");
    anchor.className = "group-anchor";
    anchor.dataset.groupSection = String(gi);
    anchor.id = `group-section-${gi}`;

    const groupEl = document.createElement("div");
    groupEl.className = "group-block";

    const gh = document.createElement("h2");
    gh.className = "group-heading";
    gh.textContent = `Grupo ${letter}`;
    groupEl.appendChild(gh);
    const rule = document.createElement("hr");
    rule.className = "group-rule";
    groupEl.appendChild(rule);

    let any = false;
    if (teamsInGroup) {
      for (const t of teamsInGroup) {
        const teamStickers = stickers.filter((s) => s.kind === "base" && s.teamId === t.id);
        teamStickers.sort((a, b) => (a.slotInTeam ?? 0) - (b.slotInTeam ?? 0));
        const visibleTeam = teamStickers.filter(stickerMatchesFilters);
        if (visibleTeam.length === 0) continue;

        any = true;
        const lane = document.createElement("div");
        lane.className = "team-lane";

        const head = document.createElement("div");
        head.className = "team-head";
        head.textContent = `${t.name_pt} (${t.id})`;
        lane.appendChild(head);

        const strip = document.createElement("div");
        strip.className = "chip-strip";
        strip.setAttribute("role", "group");
        strip.setAttribute("aria-label", `${t.name_pt} ${t.id}`);

        for (const s of visibleTeam) {
          strip.appendChild(createChip(s));
        }
        lane.appendChild(strip);
        groupEl.appendChild(lane);
      }
    }

    if (!any) {
      const empty = document.createElement("p");
      empty.className = "empty-lane";
      empty.style.cssText = "margin:0;color:var(--muted);font-size:0.875rem;";
      empty.textContent = "-";
      groupEl.appendChild(empty);
    }

    anchor.appendChild(groupEl);
    return anchor;
  }

  /** Grupo # — Introdução, Museu e Coca-Cola como “países”. */
  function buildHashGroupSection() {
    const anchor = document.createElement("section");
    anchor.className = "group-anchor";
    anchor.dataset.groupSection = String(HASH_GROUP_INDEX);
    anchor.id = `group-section-${HASH_GROUP_INDEX}`;

    const groupEl = document.createElement("div");
    groupEl.className = "group-block";

    const gh = document.createElement("h2");
    gh.className = "group-heading";
    gh.textContent = "Grupo # (indefinido)";
    groupEl.appendChild(gh);
    const rule = document.createElement("hr");
    rule.className = "group-rule";
    groupEl.appendChild(rule);

    const introList = stickers.filter((s) => s.kind === "intro").sort((a, b) => a.id - b.id);
    const museumList = stickers.filter((s) => s.kind === "museum").sort((a, b) => a.id - b.id);
    const cocaList = stickers.filter((s) => s.kind === "coca").sort((a, b) => a.id - b.id);

    let any = false;
    if (appendTeamLane(groupEl, "Introdução (INT)", introList)) any = true;
    if (appendTeamLane(groupEl, "Museu FIFA (MUS)", museumList)) any = true;
    if (appendTeamLane(groupEl, "Coca-Cola (COC)", cocaList)) any = true;

    if (!any) {
      const empty = document.createElement("p");
      empty.className = "empty-lane";
      empty.style.cssText = "margin:0;color:var(--muted);font-size:0.875rem;";
      empty.textContent = "-";
      groupEl.appendChild(empty);
    }

    anchor.appendChild(groupEl);
    return anchor;
  }

  function render() {
    const prevScroll = panelScrollEl ? panelScrollEl.scrollTop : 0;

    albumEl.innerHTML = "";
    disconnectScrollSpy();

    for (let gi = 0; gi < 12; gi++) {
      albumEl.appendChild(buildLetterGroupSection(gi));
    }
    albumEl.appendChild(buildHashGroupSection());

    if (panelScrollEl) {
      panelScrollEl.scrollTop = prevScroll;
    }

    syncSegmentUi();
    syncRailUi();
    bindScrollSpy();
  }

  segmentBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const f = btn.dataset.filter;
      if (f === "all" || f === "missing" || f === "dupes") {
        filterMode = f;
        syncSegmentUi();
        render();
      }
    });
  });

  function buildRail() {
    railEl.innerHTML = "";
    for (let i = 0; i < 12; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "group-rail-btn";
      b.dataset.groupIndex = String(i);
      b.textContent = GROUP_LETTERS[i] ?? "?";
      b.setAttribute("aria-label", `Grupo ${GROUP_LETTERS[i]}`);
      b.addEventListener("click", () => {
        const sec = albumEl.querySelector(`[data-group-section="${i}"]`);
        if (sec) {
          visibleGroupIndex = i;
          syncRailUi();
          saveUiState(i);
          sec.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      railEl.appendChild(b);
    }

    const sep = document.createElement("div");
    sep.className = "group-rail-sep";
    sep.setAttribute("aria-hidden", "true");
    railEl.appendChild(sep);

    const hashBtn = document.createElement("button");
    hashBtn.type = "button";
    hashBtn.className = "group-rail-btn group-rail-btn--hash";
    hashBtn.dataset.groupIndex = String(HASH_GROUP_INDEX);
    hashBtn.textContent = "#";
    hashBtn.setAttribute("aria-label", "Grupo indefinido: Introdução, Museu FIFA e Coca-Cola");
    hashBtn.addEventListener("click", () => {
      const sec = albumEl.querySelector(`[data-group-section="${HASH_GROUP_INDEX}"]`);
      if (sec) {
        visibleGroupIndex = HASH_GROUP_INDEX;
        syncRailUi();
        saveUiState(HASH_GROUP_INDEX);
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    railEl.appendChild(hashBtn);
  }

  /* Base na página (index.html), não no ficheiro .js — evita falhas com file:// e proxies. */
  const checklistUrl = new URL("data/checklist.json", window.location.href);
  fetch(checklistUrl.href)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    })
    .then((data) => {
      teamOrder = data.teamOrder;
      stickers = buildStickers(data);
      if (stickers.length === 0) throw new Error("empty");
      buildRail();
      syncSegmentUi();
      updateStats();
      render();
      requestAnimationFrame(() => {
        const sec = albumEl.querySelector(`[data-group-section="${visibleGroupIndex}"]`);
        sec?.scrollIntoView({ behavior: "auto", block: "start" });
        syncRailUi();
      });

      window.CromosApi = {
        resolveBackCode,
        applyIncrementsForIds,
        getQ: (id) => getQ(counts, id),
        getStickerById: (id) => stickers.find((s) => s.id === id) ?? null,
        getTeamIds: () => teamOrder.map((t) => t.id),
      };
      document.dispatchEvent(new CustomEvent("cromos-ready"));
    })
    .catch(() => {
      errEl.hidden = false;
    });
}

main();
