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
    analyzeLoading: null,
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

  /** Siglas do álbum (checklist) + FWC — manter sincronizado com `data/checklist.json`. */
  const ALBUM_CODE_STRINGS = [
    "MEX",
    "RSA",
    "KOR",
    "CZE",
    "CAN",
    "BIH",
    "QAT",
    "SUI",
    "BRA",
    "MAR",
    "HAI",
    "SCO",
    "USA",
    "PAR",
    "AUS",
    "TUR",
    "GER",
    "CUW",
    "CIV",
    "ECU",
    "NED",
    "JPN",
    "SWE",
    "TUN",
    "BEL",
    "EGY",
    "IRN",
    "NZL",
    "ESP",
    "CPV",
    "KSA",
    "URU",
    "FRA",
    "SEN",
    "IRQ",
    "NOR",
    "ARG",
    "ALG",
    "AUT",
    "JOR",
    "POR",
    "COD",
    "UZB",
    "COL",
    "ENG",
    "CRO",
    "GHA",
    "PAN",
    "FWC",
  ];

  /**
   * Uma substituição por posição: letra lida como dígito (ou o inverso no texto OCR).
   * Chave = letra correcta na sigla; valor = carácter frequentemente lido no OCR.
   */
  const OCR_LETTER_TO_CONFUSED_CHAR = {
    O: "0",
    I: "1",
    J: "1",
    Q: "0",
    S: "5",
    B: "8",
    G: "6",
    Z: "2",
    E: "3",
    A: "4",
  };

  /** @type {Map<string, string> | null} */
  let ocrWrongCodeToCanonical = null;

  function buildOcrWrongCodeToCanonical() {
    const m = new Map();
    for (const code of ALBUM_CODE_STRINGS) {
      const letters = code.split("");
      for (let i = 0; i < 3; i++) {
        const ch = letters[i];
        const confused = OCR_LETTER_TO_CONFUSED_CHAR[ch];
        if (!confused) continue;
        const w = letters.slice();
        w[i] = confused;
        const wrong = w.join("");
        if (wrong === code) continue;
        if (m.has(wrong) && m.get(wrong) !== code) continue;
        m.set(wrong, code);
      }
    }
    return m;
  }

  function getOcrWrongCodeToCanonical() {
    if (!ocrWrongCodeToCanonical) ocrWrongCodeToCanonical = buildOcrWrongCodeToCanonical();
    return ocrWrongCodeToCanonical;
  }

  /**
   * Corrige leituras típicas do verso Panini (texto branco em fundo escuro após inverter
   * pode vir como HAII6 em vez de HAI 16, TUNG em vez de TUN 4, etc.).
   * Inclui variantes geradas para todas as siglas do álbum + correções manuais extra.
   */
  function normalizeStickerCodes(t) {
    let s = normalizeOcrText(t);
    s = s.replace(/\b([A-Z]{3})II(\d)\b/g, "$1 1$2");
    s = s.replace(/\b([A-Z]{3})ll(\d)\b/g, "$1 1$2");
    s = s.replace(/\b([A-Z]{3})lI(\d)\b/g, "$1 1$2");
    s = s.replace(/\bTUNG\b/g, "TUN");
    s = s.replace(/\bTUN\s*G\s*(\||\s)/g, "TUN $1");

    const wrongMap = getOcrWrongCodeToCanonical();
    const sortedWrong = [...wrongMap.keys()].sort((a, b) => b.localeCompare(a));
    for (const wrong of sortedWrong) {
      const right = wrongMap.get(wrong);
      if (!right) continue;
      s = s.replace(new RegExp(`\\b${wrong}\\b`, "g"), right);
    }

    /** Troca de forma (U/V, R, etc.) que o mapa por letra↔dígito não cobre. */
    const manualCodeShapeFixes = [
      [/\bQ0T\b/g, "QAT"],
      [/\bFVVC\b/g, "FWC"],
      [/\bJP0\b/g, "JPN"],
      [/\b5PN\b/g, "JPN"],
      [/\bRS5\b/g, "RSA"],
      [/\bN3L\b/g, "NZL"],
      [/\bCUV\b/g, "CUW"],
      [/\bCUU\b/g, "CUW"],
      [/\bURV\b/g, "URU"],
      [/\bVRU\b/g, "URU"],
      [/\bVSA\b/g, "USA"],
      [/\bUSV\b/g, "USA"],
      [/\bM4X\b/g, "MEX"],
      [/\bR5A\b/g, "RSA"],
      [/\bK0R\b/g, "KOR"],
      [/\bHRV\b/g, "HAI"],
      [/\bNQR\b/g, "NOR"],
      [/\bN3D\b/g, "NED"],
      [/\bMED\b/g, "NED"],
      [/\bNLD\b/g, "NED"],
      [/\bN7L\b/g, "NZL"],
      [/\bPRR\b/g, "POR"],
      [/\bPQR\b/g, "POR"],
      [/\bCQL\b/g, "COL"],
      [/\bFW0\b/g, "FWC"],
    ];
    for (const [re, rep] of manualCodeShapeFixes) {
      s = s.replace(re, rep);
    }

    return s;
  }

  /** @param {string} text */
  function extractMatches(text) {
    if (!api) return [];
    const teamIds = new Set(api.getTeamIds());
    const raw = normalizeStickerCodes(text);
    const found = [];

    function tryPair(code, numStr) {
      const code3 = code.slice(0, 3);
      if (code3.length !== 3) return;
      if (code3 !== "FWC" && !teamIds.has(code3)) return;
      const numClean = String(numStr).replace(/O/g, "0").replace(/[Il]/g, "1");
      const id = api.resolveBackCode(code3, numClean);
      if (id == null) return;
      const st = api.getStickerById(id);
      const label = st ? `${st.label_pt} (#${id})` : `#${id}`;
      const q = api.getQ(id);
      found.push({
        id,
        code: code3,
        num: numClean,
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

  /** @param {File} file */
  function fileToImageCanvas(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file, { imageOrientation: "from-image" }).then(
        (bmp) => {
          const c = document.createElement("canvas");
          c.width = bmp.width;
          c.height = bmp.height;
          c.getContext("2d").drawImage(bmp, 0, 0);
          bmp.close?.();
          return c;
        },
        () => fileToImageCanvasLegacy(file),
      );
    }
    return fileToImageCanvasLegacy(file);
  }

  /** @param {File} file */
  function fileToImageCanvasLegacy(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d").drawImage(img, 0, 0);
        resolve(c);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler a imagem."));
      };
      img.src = url;
    });
  }

  function scaleCanvas(src, factor) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(src.width * factor));
    c.height = Math.max(1, Math.round(src.height * factor));
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, c.width, c.height);
    return c;
  }

  /** Redimensiona para caber num quadrado de lado maxDim (mantém proporção). */
  function resizeMaxCanvas(src, maxDim) {
    const w = src.width;
    const h = src.height;
    const m = Math.max(w, h);
    if (m <= maxDim) {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d").drawImage(src, 0, 0);
      return c;
    }
    const s = maxDim / m;
    return scaleCanvas(src, s);
  }

  function capMaxDimension(src, cap) {
    const m = Math.max(src.width, src.height);
    if (m <= cap) return src;
    return scaleCanvas(src, cap / m);
  }

  /** Uma rotação de 90° no sentido horário (eixo Y para baixo, como no canvas). */
  function rotateOnce90CW(source) {
    const c = document.createElement("canvas");
    c.width = source.height;
    c.height = source.width;
    const ctx = c.getContext("2d");
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(source, 0, 0);
    return c;
  }

  /**
   * Roda a imagem em saltos de 90° (sentido horário), para alinhar códigos na vertical
   * quando o cromo está de lado na fotografia.
   * @param {HTMLCanvasElement} source
   * @param {0 | 90 | 180 | 270} degClockwise
   */
  function rotateCanvas(source, degClockwise) {
    let steps = Math.round(degClockwise / 90) % 4;
    if (steps < 0) steps += 4;
    if (steps === 0) {
      const c = document.createElement("canvas");
      c.width = source.width;
      c.height = source.height;
      c.getContext("2d").drawImage(source, 0, 0);
      return c;
    }
    let cur = source;
    for (let i = 0; i < steps; i++) {
      cur = rotateOnce90CW(cur);
    }
    return cur;
  }

  /** Cinza + normalização de histograma; opcionalmente inverte (versos Panini: badge claro em fundo escuro). */
  function canvasGrayNormalize(source, invert) {
    const c = document.createElement("canvas");
    c.width = source.width;
    c.height = source.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(source, 0, 0);
    const im = ctx.getImageData(0, 0, c.width, c.height);
    const d = im.data;
    let min = 255;
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (y < min) min = y;
      if (y > max) max = y;
    }
    const range = max - min || 1;
    for (let i = 0; i < d.length; i += 4) {
      let y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      y = ((y - min) / range) * 255;
      const v = invert ? 255 - y : y;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }

  function splitGrid(src, rows, cols) {
    const tw = Math.floor(src.width / cols);
    const th = Math.floor(src.height / rows);
    const out = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tile = document.createElement("canvas");
        tile.width = tw;
        tile.height = th;
        tile.getContext("2d").drawImage(src, c * tw, r * th, tw, th, 0, 0, tw, th);
        out.push(tile);
      }
    }
    return out;
  }

  async function ocrCanvas(worker, canvas, psm) {
    await worker.setParameters({
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
      tessedit_pageseg_mode: String(psm),
    });
    const {
      data: { text },
    } = await worker.recognize(canvas);
    return text;
  }

  /**
   * Versos Panini: código em branco sobre cinza — inverter luminância + mosaico ajuda o Tesseract.
   * Várias passagens; texto agregado (pode haver duplicados na lista final; o utilizador remove no modal).
   */
  async function runOcrOnPhotos() {
    if (typeof Tesseract === "undefined") {
      throw new Error("Biblioteca de OCR não carregou. Verifique a rede e atualize a página.");
    }
    const worker = await Tesseract.createWorker("eng", 1, {
      logger: () => {},
    });
    const allChunks = [];
    try {
      for (const p of sessionPhotos) {
        const base = await fileToImageCanvas(p.file);
        const work = resizeMaxCanvas(base, 1400);
        let doubled = scaleCanvas(work, 2);
        doubled = capMaxDimension(doubled, 2600);

        const ROTATIONS = /** @type {const} */ ([0, 90, 180, 270]);
        for (const rotDeg of ROTATIONS) {
          const rotated = rotateCanvas(doubled, rotDeg);
          const invFull = canvasGrayNormalize(rotated, true);
          allChunks.push(await ocrCanvas(worker, invFull, 11));
          if (rotDeg === 0) {
            allChunks.push(await ocrCanvas(worker, invFull, 3));
          }
        }

        const tiles33 = splitGrid(doubled, 3, 3);
        for (const tile of tiles33) {
          const tInv = canvasGrayNormalize(tile, true);
          allChunks.push(await ocrCanvas(worker, tInv, 11));
        }

        const doubled90 = rotateCanvas(doubled, 90);
        const tiles90 = splitGrid(doubled90, 3, 3);
        for (const tile of tiles90) {
          const tInv = canvasGrayNormalize(tile, true);
          allChunks.push(await ocrCanvas(worker, tInv, 11));
        }

        const workAlt = resizeMaxCanvas(base, 1000);
        let doubledAlt = scaleCanvas(workAlt, 2);
        doubledAlt = capMaxDimension(doubledAlt, 2400);
        for (const rotDeg of /** @type {const} */ ([0, 90])) {
          const rotatedAlt = rotateCanvas(doubledAlt, rotDeg);
          const invAlt = canvasGrayNormalize(rotatedAlt, true);
          allChunks.push(await ocrCanvas(worker, invAlt, 11));
        }
      }
      return allChunks.join("\n");
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
    els.analyzeLoading = document.getElementById("ocr-analyze-loading");

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
      els.btnAddPhoto?.setAttribute("disabled", "true");
      els.btnSessionBack?.setAttribute("disabled", "true");
      els.dlgSession?.classList.add("is-analyzing");
      els.dlgSession?.setAttribute("aria-busy", "true");
      els.analyzeLoading?.classList.remove("hidden");
      try {
        const text = await runOcrOnPhotos();
        const matches = extractMatches(text);
        openConfirmModal(matches);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        alert(msg);
      } finally {
        els.btnAnalyze.disabled = false;
        els.btnAddPhoto?.removeAttribute("disabled");
        els.btnSessionBack?.removeAttribute("disabled");
        els.dlgSession?.classList.remove("is-analyzing");
        els.dlgSession?.setAttribute("aria-busy", "false");
        els.analyzeLoading?.classList.add("hidden");
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
