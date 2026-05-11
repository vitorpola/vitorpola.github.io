/**
 * OCR dos versos (códigos tipo ESP 1, FWC 5). Depende de window.CromosApi (app.js).
 */
(function () {
  let api = null;

  const els = {
    fab: null,
    input: null,
    overlay: null,
    dlgStart: null,
    dlgSession: null,
    dlgConfirm: null,
    previews: null,
    btnCapture: null,
    btnCloseStart: null,
    btnAddPhoto: null,
    btnAnalyze: null,
    btnSessionBack: null,
    confirmSummary: null,
    confirmList: null,
    btnConfirmAdd: null,
    btnConfirmClose: null,
    ocrStatus: null,
  };

  /** @type {{ file: File, url: string }[]} */
  let sessionPhotos = [];
  /** @type {{ id: number, code: string, num: string, label: string, kind: "missing" | "dupe" }[]} */
  let pendingAdds = [];
  let lastOcrIdentifiedTotal = 0;

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = String(s);
    return d.innerHTML;
  }

  function showOverlay(show) {
    if (!els.overlay) return;
    els.overlay.classList.toggle("hidden", !show);
    els.overlay.setAttribute("aria-hidden", show ? "false" : "true");
    document.body.style.overflow = show ? "hidden" : "";
  }

  function hideAllDialogs() {
    [els.dlgStart, els.dlgSession, els.dlgConfirm].forEach((d) => d?.classList.add("hidden"));
  }

  function openStartModal() {
    if (!api) return;
    hideAllDialogs();
    els.dlgStart?.classList.remove("hidden");
    showOverlay(true);
    els.btnCloseStart?.focus();
  }

  function closeEverything() {
    hideAllDialogs();
    showOverlay(false);
    sessionPhotos.forEach((p) => URL.revokeObjectURL(p.url));
    sessionPhotos = [];
    pendingAdds = [];
    renderPreviews();
  }

  function openSessionModal() {
    hideAllDialogs();
    els.dlgSession?.classList.remove("hidden");
    showOverlay(true);
    syncAnalyzeEnabled();
    els.btnAddPhoto?.focus();
  }

  function syncAnalyzeEnabled() {
    if (els.btnAnalyze) els.btnAnalyze.disabled = sessionPhotos.length === 0;
  }

  function renderPreviews() {
    if (!els.previews) return;
    els.previews.innerHTML = "";
    sessionPhotos.forEach((p, i) => {
      const wrap = document.createElement("div");
      wrap.className = "ocr-preview-item";
      const img = document.createElement("img");
      img.src = p.url;
      img.alt = `Foto ${i + 1}`;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn danger ocr-preview-remove";
      rm.textContent = "Remover";
      rm.addEventListener("click", () => {
        URL.revokeObjectURL(p.url);
        sessionPhotos.splice(i, 1);
        renderPreviews();
      });
      wrap.appendChild(img);
      wrap.appendChild(rm);
      els.previews.appendChild(wrap);
    });
    syncAnalyzeEnabled();
  }

  function triggerFilePicker() {
    els.input?.click();
  }

  function normalizeOcrText(t) {
    let s = String(t || "").toUpperCase();
    s = s.replace(/\|/g, "I").replace(/`/g, "'");
    return s;
  }

  /** @param {string} text */
  function extractMatches(text) {
    if (!api) return [];
    const teamIds = new Set(api.getTeamIds());
    const raw = normalizeOcrText(text);
    const found = [];

    function tryPair(code, numStr) {
      const code3 = code.slice(0, 3);
      if (code3.length !== 3) return;
      if (code3 !== "FWC" && !teamIds.has(code3)) return;
      const id = api.resolveBackCode(code3, numStr);
      if (id == null) return;
      const st = api.getStickerById(id);
      const label = st ? `${st.label_pt} (#${id})` : `#${id}`;
      const q = api.getQ(id);
      found.push({
        id,
        code: code3,
        num: numStr,
        label,
        kind: q === 0 ? "missing" : "dupe",
      });
    }

    const re = /\b([A-Z]{3})\s*(\d{1,2})\b/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      tryPair(m[1], m[2]);
    }

    return found;
  }

  async function runOcrOnPhotos() {
    if (typeof Tesseract === "undefined") {
      throw new Error("Biblioteca de OCR não carregou. Verifique a rede e atualize a página.");
    }
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: () => {},
    });
    try {
      await worker.setParameters({
        tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
      });
      const chunks = [];
      for (const p of sessionPhotos) {
        const {
          data: { text },
        } = await worker.recognize(p.file);
        chunks.push(text);
      }
      return chunks.join("\n\n");
    } finally {
      await worker.terminate();
    }
  }

  function renderConfirmList() {
    if (!els.confirmList || !els.confirmSummary) return;
    const n = pendingAdds.length;
    const t = lastOcrIdentifiedTotal;
    if (t === 0) {
      els.confirmSummary.textContent =
        "Nenhum cromo reconhecido com o padrão AAA 12 (sigla de país ou FWC, mais número).";
    } else if (n === t) {
      els.confirmSummary.textContent = `Quantidade identificada na leitura: ${t}. Cada linha soma +1 ao respectivo cromo. Pode remover linhas antes de confirmar.`;
    } else {
      els.confirmSummary.textContent = `Identificados na leitura: ${t}. Na lista para adicionar: ${n} (removeu ${t - n}).`;
    }

    els.confirmList.innerHTML = "";
    pendingAdds.forEach((item, idx) => {
      const row = document.createElement("div");
      row.className = "ocr-confirm-row";
      const badge = document.createElement("span");
      badge.className = item.kind === "missing" ? "ocr-badge ocr-badge-missing" : "ocr-badge ocr-badge-dupe";
      badge.textContent = item.kind === "missing" ? "Faltante" : "Repetida";
      const info = document.createElement("div");
      info.className = "ocr-confirm-info";
      info.innerHTML = `<strong>${esc(item.code)} ${esc(item.num)}</strong> · ${esc(item.label)}`;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "btn danger ocr-confirm-remove";
      rm.textContent = "Excluir";
      rm.addEventListener("click", () => {
        pendingAdds.splice(idx, 1);
        renderConfirmList();
      });
      row.appendChild(badge);
      row.appendChild(info);
      row.appendChild(rm);
      els.confirmList.appendChild(row);
    });

    els.btnConfirmAdd.disabled = pendingAdds.length === 0;
  }

  function openConfirmModal(matches) {
    lastOcrIdentifiedTotal = matches.length;
    pendingAdds = matches.slice();
    hideAllDialogs();
    els.dlgConfirm?.classList.remove("hidden");
    showOverlay(true);
    renderConfirmList();
    els.btnConfirmClose?.focus();
  }

  function wire() {
    els.fab = document.getElementById("ocr-fab");
    els.input = document.getElementById("ocr-input");
    els.overlay = document.getElementById("ocr-overlay");
    els.dlgStart = document.getElementById("ocr-dialog-start");
    els.dlgSession = document.getElementById("ocr-dialog-session");
    els.dlgConfirm = document.getElementById("ocr-dialog-confirm");
    els.previews = document.getElementById("ocr-previews");
    els.btnCapture = document.getElementById("ocr-btn-capture");
    els.btnCloseStart = document.getElementById("ocr-btn-close-start");
    els.btnAddPhoto = document.getElementById("ocr-btn-add-photo");
    els.btnAnalyze = document.getElementById("ocr-btn-analyze");
    els.btnSessionBack = document.getElementById("ocr-btn-session-back");
    els.confirmSummary = document.getElementById("ocr-confirm-summary");
    els.confirmList = document.getElementById("ocr-confirm-list");
    els.btnConfirmAdd = document.getElementById("ocr-btn-confirm-add");
    els.btnConfirmClose = document.getElementById("ocr-btn-confirm-close");
    els.ocrStatus = document.getElementById("ocr-status");

    els.fab?.addEventListener("click", () => openStartModal());

    els.btnCloseStart?.addEventListener("click", () => closeEverything());

    els.btnCapture?.addEventListener("click", () => {
      triggerFilePicker();
    });

    els.input?.addEventListener("change", () => {
      const input = els.input;
      if (!input?.files?.length) return;
      for (const file of input.files) {
        if (!file.type.startsWith("image/")) continue;
        const url = URL.createObjectURL(file);
        sessionPhotos.push({ file, url });
      }
      input.value = "";
      if (sessionPhotos.length) {
        openSessionModal();
        renderPreviews();
      }
    });

    els.btnAddPhoto?.addEventListener("click", () => triggerFilePicker());

    els.btnSessionBack?.addEventListener("click", () => {
      closeEverything();
    });

    els.btnAnalyze?.addEventListener("click", async () => {
      if (!sessionPhotos.length || !api) return;
      if (els.btnAnalyze?.disabled) return;
      els.btnAnalyze.disabled = true;
      if (els.ocrStatus) {
        els.ocrStatus.hidden = false;
        els.ocrStatus.textContent = "A analisar imagens…";
      }
      try {
        const text = await runOcrOnPhotos();
        const matches = extractMatches(text);
        openConfirmModal(matches);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(msg);
      } finally {
        els.btnAnalyze.disabled = false;
        if (els.ocrStatus) els.ocrStatus.hidden = true;
      }
    });

    els.btnConfirmClose?.addEventListener("click", () => {
      closeEverything();
    });

    els.btnConfirmAdd?.addEventListener("click", () => {
      if (!api || !pendingAdds.length) return;
      const ids = pendingAdds.map((x) => x.id);
      api.applyIncrementsForIds(ids);
      closeEverything();
    });

    els.overlay?.addEventListener("click", (ev) => {
      const t = ev.target;
      if (t && /** @type {HTMLElement} */ (t).classList?.contains("ocr-backdrop")) {
        if (els.dlgConfirm && !els.dlgConfirm.classList.contains("hidden")) return;
        closeEverything();
      }
    });
  }

  function bindApi() {
    api = window.CromosApi;
    if (els.fab) els.fab.disabled = !api;
  }

  wire();
  syncAnalyzeEnabled();
  document.addEventListener("cromos-ready", bindApi);
  if (window.CromosApi) bindApi();
})();
