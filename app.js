const PRESET_RATIOS = {
  "1:1": [1, 1],
  "3:4": [3, 4],
  "4:3": [4, 3],
  "9:16": [9, 16],
  "16:9": [16, 9],
};

const FILTER_PRESETS = {
  none: { label: "원본", extra: "" },
  mono: { label: "흑백", extra: "grayscale(1)" },
  warm: { label: "따뜻함", extra: "sepia(0.28) saturate(1.2) hue-rotate(-12deg)" },
  cool: { label: "차가움", extra: "hue-rotate(16deg) saturate(1.08) brightness(1.03)" },
  vintage: { label: "빈티지", extra: "sepia(0.42) contrast(0.92) brightness(1.06) saturate(0.82)" },
  vivid: { label: "선명", extra: "saturate(1.45) contrast(1.12)" },
  fade: { label: "페이드", extra: "contrast(0.86) brightness(1.12) saturate(0.72)" },
  dramatic: { label: "드라마틱", extra: "contrast(1.32) saturate(1.12) brightness(0.94)" },
  soft: { label: "소프트", extra: "contrast(0.9) brightness(1.08) saturate(0.92)" },
  sepia: { label: "세피아", extra: "sepia(0.85)" },
};

const state = {
  items: [],
  ratio: "1:1",
  editingId: null,
  processing: false,
  view: "home",
  tool: "view",
  mosaicSize: "small",
  mosaicAction: "paint",
  colorAction: "paint",
  colorKeepMode: "match",
  drawing: false,
  needsColorRebuild: false,
};

const el = {
  homeView: document.getElementById("homeView"),
  editorView: document.getElementById("editorView"),
  dropzone: document.getElementById("dropzone"),
  fileInput: document.getElementById("fileInput"),
  browseBtn: document.getElementById("browseBtn"),
  workspace: document.getElementById("workspace"),
  gallery: document.getElementById("gallery"),
  fileCount: document.getElementById("fileCount"),
  ratioGroup: document.getElementById("ratioGroup"),
  customRatio: document.getElementById("customRatio"),
  customW: document.getElementById("customW"),
  customH: document.getElementById("customH"),
  applyAllBtn: document.getElementById("applyAllBtn"),
  selectAllBtn: document.getElementById("selectAllBtn"),
  deleteSelectedBtn: document.getElementById("deleteSelectedBtn"),
  zipName: document.getElementById("zipName"),
  zipBtn: document.getElementById("zipBtn"),
  backBtn: document.getElementById("backBtn"),
  prevBtn: document.getElementById("prevBtn"),
  nextBtn: document.getElementById("nextBtn"),
  editorFileLabel: document.getElementById("editorFileLabel"),
  editorCanvas: document.getElementById("editorCanvas"),
  editorRatioGroup: document.getElementById("editorRatioGroup"),
  editorCustom: document.getElementById("editorCustom"),
  editorW: document.getElementById("editorW"),
  editorH: document.getElementById("editorH"),
  filterGroup: document.getElementById("filterGroup"),
  brightSlider: document.getElementById("brightSlider"),
  contrastSlider: document.getElementById("contrastSlider"),
  saturateSlider: document.getElementById("saturateSlider"),
  brightVal: document.getElementById("brightVal"),
  contrastVal: document.getElementById("contrastVal"),
  saturateVal: document.getElementById("saturateVal"),
  editorFilename: document.getElementById("editorFilename"),
  editorApplyBtn: document.getElementById("editorApplyBtn"),
  editorDownloadBtn: document.getElementById("editorDownloadBtn"),
  editorDeleteBtn: document.getElementById("editorDeleteBtn"),
  editorFrame: document.getElementById("editorFrame"),
  toolHint: document.getElementById("toolHint"),
  toolGroup: document.getElementById("toolGroup"),
  mosaicTools: document.getElementById("mosaicTools"),
  mosaicSizeGroup: document.getElementById("mosaicSizeGroup"),
  mosaicActionGroup: document.getElementById("mosaicActionGroup"),
  colorActionGroup: document.getElementById("colorActionGroup"),
  colorModeGroup: document.getElementById("colorModeGroup"),
  colorModeHint: document.getElementById("colorModeHint"),
  colorRangeBox: document.getElementById("colorRangeBox"),
  colorTools: document.getElementById("colorTools"),
  colorSwatch: document.getElementById("colorSwatch"),
  colorSwatchLabel: document.getElementById("colorSwatchLabel"),
  colorTolSlider: document.getElementById("colorTolSlider"),
  colorTolVal: document.getElementById("colorTolVal"),
  clearColorBtn: document.getElementById("clearColorBtn"),
  toast: document.getElementById("toast"),
};

function defaultFilters() {
  return { preset: "none", brightness: 100, contrast: 100, saturate: 100 };
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.toast.classList.add("hidden"), 2400);
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function splitName(filename) {
  const i = filename.lastIndexOf(".");
  if (i <= 0) return { base: filename, ext: "jpg" };
  return { base: filename.slice(0, i), ext: filename.slice(i + 1).toLowerCase() };
}

function mimeFromExt(ext) {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

function exportExt(ext) {
  if (["png", "webp", "jpg", "jpeg"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  return "jpg";
}

function ratioTag(ratioKey, customW, customH) {
  if (ratioKey === "original") return "original";
  if (ratioKey === "custom") {
    const w = Number(customW) || 0;
    const h = Number(customH) || 0;
    return `${w}x${h}`;
  }
  return ratioKey.replace(":", "x");
}

function defaultFilename(item, ratioKey, customW, customH) {
  const { base, ext } = splitName(item.originalName);
  return `${base}_${ratioTag(ratioKey, customW, customH)}.${exportExt(ext)}`;
}

function currentFitMode() {
  return document.querySelector('input[name="fitMode"]:checked')?.value || "crop";
}

function parseRatio(ratioKey, customW, customH, imgW = 1, imgH = 1) {
  if (ratioKey === "original") return [imgW, imgH];
  if (ratioKey !== "custom") return PRESET_RATIOS[ratioKey] || null;
  const w = Number(customW);
  const h = Number(customH);
  if (!w || !h || w <= 0 || h <= 0) return null;
  return [w, h];
}

function computeOutputSize(imgW, imgH, ratioKey, ratio, mode, customPixels) {
  if (ratioKey === "original") return { width: imgW, height: imgH };
  const [rw, rh] = ratio;
  const target = rw / rh;
  const exactCanvas = customPixels && customPixels[0] >= 32 && customPixels[1] >= 32;

  if (exactCanvas) {
    return { width: Math.round(customPixels[0]), height: Math.round(customPixels[1]) };
  }

  if (mode === "crop") {
    if (imgW / imgH > target) {
      return { width: Math.round(imgH * target), height: imgH };
    }
    return { width: imgW, height: Math.round(imgW / target) };
  }

  if (imgW / imgH > target) {
    return { width: imgW, height: Math.round(imgW / target) };
  }
  return { width: Math.round(imgH * target), height: imgH };
}

function buildFilterCss(filters = defaultFilters()) {
  const extra = FILTER_PRESETS[filters.preset]?.extra || "";
  return [
    extra,
    `brightness(${filters.brightness / 100})`,
    `contrast(${filters.contrast / 100})`,
    `saturate(${filters.saturate / 100})`,
  ].filter(Boolean).join(" ");
}

function drawProcessed(ctx, image, width, height, mode, filters) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.filter = "none";
  ctx.fillRect(0, 0, width, height);
  ctx.filter = buildFilterCss(filters);

  if (mode === "stretch") {
    ctx.drawImage(image, 0, 0, width, height);
  } else {
    const scale = Math.max(width / image.width, height / image.height);
    const dw = image.width * scale;
    const dh = image.height * scale;
    const dx = (width - dw) / 2;
    const dy = (height - dh) / 2;
    ctx.drawImage(image, dx, dy, dw, dh);
  }
  ctx.filter = "none";
}

function mosaicBlock(width, height, kind) {
  const m = Math.min(width, height);
  return kind === "large" ? Math.max(16, Math.round(m / 28)) : Math.max(6, Math.round(m / 80));
}

function toGray(data, i) {
  const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  data[i] = data[i + 1] = data[i + 2] = gray;
}

function applyRegionKeep(ctx, marks) {
  if (!marks?.length) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const mctx = mask.getContext("2d");
  mctx.fillStyle = "#fff";
  const radius = regionRadius(w, h);
  marks.forEach((mark) => {
    mctx.beginPath();
    mctx.arc(mark.nx * w, mark.ny * h, radius, 0, Math.PI * 2);
    mctx.fill();
  });
  const maskData = mctx.getImageData(0, 0, w, h).data;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  for (let i = 0; i < data.length; i += 4) {
    if (maskData[i] < 128) toGray(data, i);
  }
  ctx.putImageData(img, 0, 0);
}

function applyColorKeep(ctx, item) {
  if (!item) return;
  if ((item.colorKeepMode || "match") === "region") {
    applyRegionKeep(ctx, item.colorRegion);
    return;
  }
  const keep = item.keepColor;
  if (!keep?.colors?.length) return;
  const { colors, tolerance } = keep;
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = img.data;
  const limit = tolerance * tolerance;
  for (let i = 0; i < data.length; i += 4) {
    let keepPx = false;
    for (let c = 0; c < colors.length; c += 1) {
      const dr = data[i] - colors[c].r;
      const dg = data[i + 1] - colors[c].g;
      const db = data[i + 2] - colors[c].b;
      if (dr * dr + dg * dg + db * db <= limit) {
        keepPx = true;
        break;
      }
    }
    if (!keepPx) toGray(data, i);
  }
  ctx.putImageData(img, 0, 0);
}

function regionRadius(width, height) {
  return Math.max(10, Math.round(Math.min(width, height) / 28));
}

function drawRegionOverlay(ctx, marks) {
  if (!marks?.length) return;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const radius = regionRadius(w, h);
  ctx.save();
  ctx.fillStyle = "rgba(255, 196, 0, 0.32)";
  marks.forEach((mark) => {
    ctx.beginPath();
    ctx.arc(mark.nx * w, mark.ny * h, radius, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function sampleColorsFromRegion(sourceCtx, marks) {
  if (!marks?.length) return [];
  const w = sourceCtx.canvas.width;
  const h = sourceCtx.canvas.height;
  const img = sourceCtx.getImageData(0, 0, w, h);
  const data = img.data;
  const radius = regionRadius(w, h);
  const buckets = new Map();
  marks.forEach((mark) => {
    const cx = Math.round(mark.nx * w);
    const cy = Math.round(mark.ny * h);
    const x0 = Math.max(0, cx - radius);
    const y0 = Math.max(0, cy - radius);
    const x1 = Math.min(w - 1, cx + radius);
    const y1 = Math.min(h - 1, cy + radius);
    const r2 = radius * radius;
    for (let y = y0; y <= y1; y += 2) {
      for (let x = x0; x <= x1; x += 2) {
        if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > r2) continue;
        const i = (y * w + x) * 4;
        const key = `${data[i] >> 4}-${data[i + 1] >> 4}-${data[i + 2] >> 4}`;
        const prev = buckets.get(key);
        if (prev) {
          prev.n += 1;
          prev.r += data[i];
          prev.g += data[i + 1];
          prev.b += data[i + 2];
        } else {
          buckets.set(key, { n: 1, r: data[i], g: data[i + 1], b: data[i + 2] });
        }
      }
    }
  });
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, 36)
    .map((b) => ({
      r: Math.round(b.r / b.n),
      g: Math.round(b.g / b.n),
      b: Math.round(b.b / b.n),
    }));
}

function rebuildKeepColor(item) {
  if (!item.colorRegion?.length) {
    item.keepColor = null;
    return;
  }
  if ((item.colorKeepMode || "match") === "region") return;
  const options = editorOptions();
  const canvas = el.editorCanvas;
  const sample = document.createElement("canvas");
  sample.width = canvas.width;
  sample.height = canvas.height;
  const ctx = sample.getContext("2d", { willReadFrequently: true });
  drawProcessed(ctx, item.image, sample.width, sample.height, options.mode, options.filters);
  item.keepColor = {
    colors: sampleColorsFromRegion(ctx, item.colorRegion),
    tolerance: Number(el.colorTolSlider.value),
  };
}

function mosaicBrush(ctx, cx, cy, kind) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const block = mosaicBlock(w, h, kind);
  const radius = block * 2.2;
  const x0 = Math.max(0, Math.floor((cx - radius) / block) * block);
  const y0 = Math.max(0, Math.floor((cy - radius) / block) * block);
  const x1 = Math.min(w, Math.ceil((cx + radius) / block) * block);
  const y1 = Math.min(h, Math.ceil((cy + radius) / block) * block);
  const bw = x1 - x0;
  const bh = y1 - y0;
  if (bw < 1 || bh < 1) return;
  const img = ctx.getImageData(x0, y0, bw, bh);
  const data = img.data;
  for (let by = 0; by < bh; by += block) {
    for (let bx = 0; bx < bw; bx += block) {
      const px = x0 + bx + block / 2;
      const py = y0 + by + block / 2;
      if ((px - cx) ** 2 + (py - cy) ** 2 > radius * radius) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const tw = Math.min(block, bw - bx);
      const th = Math.min(block, bh - by);
      for (let y = 0; y < th; y += 1) {
        for (let x = 0; x < tw; x += 1) {
          const i = ((by + y) * bw + (bx + x)) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n += 1;
        }
      }
      if (!n) continue;
      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);
      for (let y = 0; y < th; y += 1) {
        for (let x = 0; x < tw; x += 1) {
          const i = ((by + y) * bw + (bx + x)) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
      }
    }
  }
  ctx.putImageData(img, x0, y0);
}

function applyMosaicMarks(ctx, marks) {
  (marks || []).forEach((mark) => {
    mosaicBrush(ctx, mark.nx * ctx.canvas.width, mark.ny * ctx.canvas.height, mark.kind);
  });
}

function renderItemToContext(ctx, item, width, height, options) {
  drawProcessed(ctx, item.image, width, height, options.mode, options.filters);
  applyColorKeep(ctx, item);
  applyMosaicMarks(ctx, item.mosaicMarks);
  if (options.showRegion && (item.colorKeepMode || "match") !== "region") {
    drawRegionOverlay(ctx, item.colorRegion);
  }
}

async function processItem(item, options) {
  const ratio = parseRatio(options.ratio, options.customW, options.customH, item.image.width, item.image.height);
  if (!ratio) throw new Error("커스텀 비율의 가로·세로를 입력하세요.");

  const customPixels = options.ratio === "custom"
    ? [Number(options.customW), Number(options.customH)]
    : null;
  const size = computeOutputSize(
    item.image.width,
    item.image.height,
    options.ratio,
    ratio,
    options.mode,
    customPixels
  );
  const filters = options.filters || item.filters || defaultFilters();

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, size.width);
  canvas.height = Math.max(1, size.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  renderItemToContext(ctx, item, canvas.width, canvas.height, { ...options, filters });

  const { ext } = splitName(options.filename || defaultFilename(item, options.ratio, options.customW, options.customH));
  const mime = mimeFromExt(ext);
  const quality = mime === "image/jpeg" ? 0.92 : undefined;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
  if (item.processed?.url) URL.revokeObjectURL(item.processed.url);

  item.processed = {
    blob,
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
    ratio: options.ratio,
    mode: options.mode,
    filters: { ...filters },
  };
  item.filters = { ...filters };
  item.filename = options.filename || defaultFilename(item, options.ratio, options.customW, options.customH);
  return item;
}

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 열 수 없습니다."));
    };
    image.src = url;
  });
}

async function addFiles(fileList) {
  const files = [...fileList].filter((f) => f.type.startsWith("image/"));
  if (!files.length) {
    toast("이미지 파일만 올릴 수 있습니다.");
    return;
  }

  for (const file of files) {
    try {
      const { image, url } = await loadImageFile(file);
      const autoName = defaultFilename(
        { originalName: file.name },
        state.ratio,
        el.customW.value,
        el.customH.value
      );
      state.items.push({
        id: uid(),
        file,
        originalName: file.name,
        image,
        previewUrl: url,
        selected: true,
        processed: null,
        filters: defaultFilters(),
        mosaicMarks: [],
        colorRegion: [],
        colorKeepMode: "match",
        keepColor: null,
        filename: autoName,
        autoName,
      });
    } catch {
      toast(`${file.name} 을(를) 불러오지 못했습니다.`);
    }
  }

  el.workspace.classList.remove("hidden");
  renderGallery();
  setProgress(0, "편집 대기");
}

function setProgress(pct, label) {
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  document.querySelectorAll('[data-progress="fill"]').forEach((n) => { n.style.width = `${value}%`; });
  document.querySelectorAll('[data-progress="pct"]').forEach((n) => { n.textContent = `${value}%`; });
  document.querySelectorAll('[data-progress="label"]').forEach((n) => { n.textContent = label; });
  document.querySelectorAll('[data-progress="bar"]').forEach((n) => n.setAttribute("aria-valuenow", String(value)));
}

function showHome() {
  state.view = "home";
  state.editingId = null;
  el.homeView.classList.remove("hidden");
  el.editorView.classList.add("hidden");
  if (state.items.length) {
    el.workspace.classList.remove("hidden");
    renderGallery();
  } else {
    el.workspace.classList.add("hidden");
  }
}

function renderGallery() {
  el.fileCount.textContent = String(state.items.length);
  el.gallery.innerHTML = "";

  state.items.forEach((item) => {
    const card = document.createElement("article");
    card.className = `card${item.selected ? " selected" : ""}`;
    card.dataset.id = item.id;
    const done = Boolean(item.processed);
    const filterLabel = FILTER_PRESETS[item.filters?.preset]?.label || "원본";

    card.innerHTML = `
      <div class="thumb-wrap">
        <input class="card-check" type="checkbox" ${item.selected ? "checked" : ""} aria-label="일괄 다운로드에 포함" />
        <img class="thumb-img" src="${item.processed?.url || item.previewUrl}" alt="${item.originalName}" />
        <div class="icon-tools">
          <button type="button" class="tool-btn resize-btn" title="개별 편집" aria-label="개별 편집">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 1v2H3v4H1V1h6zm16 0v6h-2V3h-4V1h6zM7 21v2H1v-6h2v4h4zm16-6v6h-6v-2h4v-4h2zM9 8h6v8H9V8zm1.5 1.5v5h3v-5h-3z"/></svg>
          </button>
          <button type="button" class="tool-btn download-btn" title="다운로드" aria-label="다운로드" ${done ? "" : "disabled"}>
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11 3h2v10.2l3.1-3.1 1.4 1.4L12 17l-5.5-5.5 1.4-1.4L11 13.2V3zM5 19h14v2H5z"/></svg>
          </button>
          <button type="button" class="tool-btn danger delete-btn" title="삭제" aria-label="삭제">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M9 3h6l1 2h5v2H3V5h5l1-2zm1 6h2v10h-2V9zm4 0h2v10h-2V9zM7 9h2v10H7V9z"/></svg>
          </button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-name">${item.originalName}</div>
        <div class="card-meta">원본 ${item.image.width} × ${item.image.height}${done ? ` · 편집 ${item.processed.width} × ${item.processed.height}` : ""} · 필터 ${filterLabel}</div>
        <div class="card-status ${done ? "done" : ""}">${done ? "편집 완료" : "편집 전 · 클릭하여 개별 편집"}</div>
        <label class="filename-field">저장 파일명
          <input type="text" class="name-input" value="${item.filename}" />
        </label>
      </div>
    `;

    card.querySelector(".card-check").addEventListener("click", (e) => e.stopPropagation());
    card.querySelector(".card-check").addEventListener("change", (e) => {
      item.selected = e.target.checked;
      card.classList.toggle("selected", item.selected);
    });
    card.querySelector(".name-input").addEventListener("click", (e) => e.stopPropagation());
    card.querySelector(".name-input").addEventListener("input", (e) => {
      item.filename = e.target.value.trim() || item.filename;
    });
    card.querySelector(".thumb-img").addEventListener("click", () => openEditor(item.id));
    card.querySelector(".resize-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      openEditor(item.id);
    });
    card.querySelector(".download-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      downloadItem(item);
    });
    card.querySelector(".delete-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteItems([item.id]);
    });
    el.gallery.appendChild(card);
  });
}

function refreshFilenamesForRatio() {
  state.items.forEach((item) => {
    if (item.processed) return;
    const autoName = defaultFilename(item, state.ratio, el.customW.value, el.customH.value);
    if (!item.filename || item.filename === item.autoName) item.filename = autoName;
    item.autoName = autoName;
  });
  if (state.items.length && state.view === "home") renderGallery();
}

function setRatioButtons(group, ratio) {
  group.querySelectorAll(".chip").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.ratio === ratio);
  });
}

function renderFilterButtons(active) {
  el.filterGroup.innerHTML = "";
  Object.entries(FILTER_PRESETS).forEach(([key, preset]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `chip${key === active ? " active" : ""}`;
    btn.dataset.filter = key;
    btn.textContent = preset.label;
    btn.addEventListener("click", () => {
      const item = currentItem();
      if (!item) return;
      item.filters.preset = key;
      renderFilterButtons(key);
      updateEditorPreview();
    });
    el.filterGroup.appendChild(btn);
  });
}

function currentItem() {
  return state.items.find((i) => i.id === state.editingId);
}

function editorOptions() {
  const ratioBtn = el.editorRatioGroup.querySelector(".chip.active");
  const item = currentItem();
  return {
    ratio: ratioBtn?.dataset.ratio || "1:1",
    customW: el.editorW.value,
    customH: el.editorH.value,
    mode: document.querySelector('input[name="editorFit"]:checked')?.value || "crop",
    filename: el.editorFilename.value.trim(),
    filters: item ? { ...item.filters } : defaultFilters(),
  };
}

function updateEditorPreview() {
  const item = currentItem();
  if (!item) return;
  const options = editorOptions();
  const ratio = parseRatio(options.ratio, options.customW, options.customH, item.image.width, item.image.height);
  if (!ratio) return;
  const customPixels = options.ratio === "custom" ? [Number(options.customW), Number(options.customH)] : null;
  const size = computeOutputSize(item.image.width, item.image.height, options.ratio, ratio, options.mode, customPixels);
  const maxSide = 720;
  const scale = Math.min(maxSide / size.width, maxSide / size.height, 1);
  const canvas = el.editorCanvas;
  canvas.width = Math.max(1, Math.round(size.width * scale));
  canvas.height = Math.max(1, Math.round(size.height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  renderItemToContext(ctx, item, canvas.width, canvas.height, { ...options, showRegion: state.tool === "color" });
  updateColorSwatch(item);
  syncToolUi();

  const autoName = defaultFilename(item, options.ratio, options.customW, options.customH);
  if (!el.editorFilename.value || el.editorFilename.value === item.autoName) {
    el.editorFilename.value = autoName;
    item.autoName = autoName;
  }
  el.editorDownloadBtn.disabled = !item.processed;
  el.editorFileLabel.textContent = `${item.originalName} · 원본 ${item.image.width}×${item.image.height}`;
}

function openEditor(id) {
  const item = state.items.find((i) => i.id === id);
  if (!item) return;
  state.editingId = id;
  state.view = "editor";
  if (!item.filters) item.filters = defaultFilters();
  if (!item.mosaicMarks) item.mosaicMarks = [];
  if (!item.colorRegion) item.colorRegion = [];
  if (!item.colorKeepMode) item.colorKeepMode = "match";
  state.colorKeepMode = item.colorKeepMode;

  el.homeView.classList.add("hidden");
  el.editorView.classList.remove("hidden");

  const ratio = item.processed?.ratio || state.ratio;
  setRatioButtons(el.editorRatioGroup, ratio);
  el.editorCustom.classList.toggle("hidden", ratio !== "custom");
  el.editorW.value = el.customW.value;
  el.editorH.value = el.customH.value;
  const mode = item.processed?.mode || currentFitMode();
  const fit = document.querySelector(`input[name="editorFit"][value="${mode}"]`);
  if (fit) fit.checked = true;

  el.brightSlider.value = item.filters.brightness;
  el.contrastSlider.value = item.filters.contrast;
  el.saturateSlider.value = item.filters.saturate;
  el.brightVal.textContent = `${item.filters.brightness}%`;
  el.contrastVal.textContent = `${item.filters.contrast}%`;
  el.saturateVal.textContent = `${item.filters.saturate}%`;
  el.editorFilename.value = item.filename;
  renderFilterButtons(item.filters.preset);
  el.colorTolSlider.value = item.keepColor?.tolerance || Number(el.colorTolSlider.value) || 55;
  el.colorTolVal.textContent = String(el.colorTolSlider.value);
  updateEditorPreview();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function stepEditor(delta) {
  const index = state.items.findIndex((i) => i.id === state.editingId);
  if (index < 0) return;
  const next = state.items[index + delta];
  if (next) openEditor(next.id);
}

function deleteItems(ids) {
  ids.forEach((id) => {
    const item = state.items.find((i) => i.id === id);
    if (!item) return;
    URL.revokeObjectURL(item.previewUrl);
    if (item.processed?.url) URL.revokeObjectURL(item.processed.url);
  });
  state.items = state.items.filter((i) => !ids.includes(i.id));
  toast(ids.length > 1 ? `${ids.length}장을 삭제했습니다.` : "사진을 삭제했습니다.");

  if (state.view === "editor") {
    if (!state.items.length) {
      showHome();
      return;
    }
    const still = state.items.find((i) => i.id === state.editingId);
    if (!still) openEditor(state.items[0].id);
    return;
  }
  renderGallery();
  if (!state.items.length) el.workspace.classList.add("hidden");
}

el.ratioGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  state.ratio = btn.dataset.ratio;
  setRatioButtons(el.ratioGroup, state.ratio);
  el.customRatio.classList.toggle("hidden", state.ratio !== "custom");
  refreshFilenamesForRatio();
});

["input", "change"].forEach((evt) => {
  el.customW.addEventListener(evt, refreshFilenamesForRatio);
  el.customH.addEventListener(evt, refreshFilenamesForRatio);
});

el.browseBtn.addEventListener("click", () => el.fileInput.click());
el.fileInput.addEventListener("change", (e) => {
  addFiles(e.target.files);
  e.target.value = "";
});

["dragenter", "dragover"].forEach((evt) => {
  el.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    el.dropzone.classList.add("dragover");
  });
});
["dragleave", "drop"].forEach((evt) => {
  el.dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    if (evt === "drop") addFiles(e.dataTransfer.files);
    el.dropzone.classList.remove("dragover");
  });
});

el.selectAllBtn.addEventListener("click", () => {
  const allOn = state.items.every((i) => i.selected);
  state.items.forEach((i) => { i.selected = !allOn; });
  el.selectAllBtn.textContent = allOn ? "전체 선택" : "전체 해제";
  renderGallery();
});

el.deleteSelectedBtn.addEventListener("click", () => {
  const ids = state.items.filter((i) => i.selected).map((i) => i.id);
  if (!ids.length) {
    toast("삭제할 사진을 선택하세요.");
    return;
  }
  deleteItems(ids);
});

async function applyToItems(items, options) {
  if (!items.length) {
    toast("적용할 사진을 선택하세요.");
    return;
  }
  if (options.ratio === "custom" && !parseRatio(options.ratio, options.customW, options.customH)) {
    toast("커스텀 가로·세로 값을 입력하세요.");
    return;
  }

  state.processing = true;
  el.applyAllBtn.disabled = true;
  setProgress(0, "편집 시작");

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const autoName = defaultFilename(item, options.ratio, options.customW, options.customH);
    const filename = item.filename && item.filename !== item.autoName ? item.filename : autoName;
    item.autoName = autoName;
    await processItem(item, {
      ...options,
      filename,
      filters: options.filters || item.filters || defaultFilters(),
    });
    setProgress(((i + 1) / items.length) * 100, `${i + 1} / ${items.length} 장 편집 중`);
    if (state.view === "home") renderGallery();
    await new Promise((r) => setTimeout(r, 40));
  }

  setProgress(100, "편집 완료");
  state.processing = false;
  el.applyAllBtn.disabled = false;
  toast("선택한 사진 편집이 완료되었습니다.");
}

el.applyAllBtn.addEventListener("click", () => {
  const selected = state.items.filter((i) => i.selected);
  applyToItems(selected, {
    ratio: state.ratio,
    customW: el.customW.value,
    customH: el.customH.value,
    mode: currentFitMode(),
  });
});

function downloadBlob(blob, filename) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadItem(item) {
  if (!item.processed) {
    toast("먼저 편집을 적용하세요.");
    return;
  }
  downloadBlob(item.processed.blob, item.filename || defaultFilename(item, item.processed.ratio, el.customW.value, el.customH.value));
}

el.zipBtn.addEventListener("click", async () => {
  const selected = state.items.filter((i) => i.selected && i.processed);
  if (!selected.length) {
    toast("편집이 끝난 선택 파일이 없습니다.");
    return;
  }
  let zipName = (el.zipName.value || "edited_photos.zip").trim();
  if (!zipName.toLowerCase().endsWith(".zip")) zipName += ".zip";
  const files = selected.map((item) => ({
    name: item.filename || defaultFilename(item, item.processed.ratio),
    blob: item.processed.blob,
  }));
  setProgress(70, "ZIP 파일 만드는 중");
  downloadBlob(await createZip(files), zipName);
  setProgress(100, "ZIP 다운로드 완료");
});

el.backBtn.addEventListener("click", showHome);
el.prevBtn.addEventListener("click", () => stepEditor(-1));
el.nextBtn.addEventListener("click", () => stepEditor(1));

el.editorRatioGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  setRatioButtons(el.editorRatioGroup, btn.dataset.ratio);
  el.editorCustom.classList.toggle("hidden", btn.dataset.ratio !== "custom");
  updateEditorPreview();
});

el.editorCustom.addEventListener("input", updateEditorPreview);
document.querySelectorAll('input[name="editorFit"]').forEach((r) => r.addEventListener("change", updateEditorPreview));

function bindSlider(slider, labelEl, key) {
  slider.addEventListener("input", () => {
    const item = currentItem();
    if (!item) return;
    item.filters[key] = Number(slider.value);
    labelEl.textContent = `${slider.value}%`;
    updateEditorPreview();
  });
}
bindSlider(el.brightSlider, el.brightVal, "brightness");
bindSlider(el.contrastSlider, el.contrastVal, "contrast");
bindSlider(el.saturateSlider, el.saturateVal, "saturate");

el.editorFilename.addEventListener("input", () => {
  const item = currentItem();
  if (item) item.filename = el.editorFilename.value.trim() || item.filename;
});

el.editorApplyBtn.addEventListener("click", async () => {
  const item = currentItem();
  if (!item) return;
  try {
    setProgress(25, "사진 편집 중");
    await processItem(item, editorOptions());
    item.selected = true;
    setProgress(100, "편집 완료");
    el.editorDownloadBtn.disabled = false;
    toast("이 사진 편집이 적용되었습니다.");
  } catch (err) {
    toast(err.message);
  }
});

el.editorDownloadBtn.addEventListener("click", () => {
  const item = currentItem();
  if (item) downloadItem(item);
});

el.editorDeleteBtn.addEventListener("click", () => {
  const item = currentItem();
  if (item) deleteItems([item.id]);
});

const TOOL_HINTS = {
  view: "사진을 보면서 비율과 필터를 맞추세요.",
  mosaic: "칠하기 또는 지우기를 고른 뒤 마우스로 문지르세요.",
  color: "구간을 마우스로 칠하세요.",
};

function syncToolUi() {
  el.mosaicTools.classList.toggle("hidden", state.tool !== "mosaic");
  el.colorTools.classList.toggle("hidden", state.tool !== "color");
  el.editorFrame.classList.toggle("tool-mosaic", state.tool === "mosaic");
  el.editorFrame.classList.toggle("tool-color", state.tool === "color");
  el.editorFrame.classList.toggle("erasing", (state.tool === "mosaic" && state.mosaicAction === "erase") || (state.tool === "color" && state.colorAction === "erase"));
  el.toolHint.textContent = TOOL_HINTS[state.tool];
  el.toolGroup.querySelectorAll(".chip").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === state.tool);
  });
  el.mosaicSizeGroup.querySelectorAll(".chip").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.size === state.mosaicSize);
  });
  el.mosaicActionGroup.querySelectorAll(".chip").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.action === state.mosaicAction);
  });
  el.colorActionGroup.querySelectorAll(".chip").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.action === state.colorAction);
  });
  const keepMode = currentItem()?.colorKeepMode || state.colorKeepMode;
  el.colorModeGroup.querySelectorAll(".chip").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === keepMode);
  });
  el.colorRangeBox.classList.toggle("hidden", keepMode === "region");
  el.colorModeHint.textContent = keepMode === "region"
    ? "칠한 구간만 컬러로 두고, 나머지 픽셀은 흑백이 됩니다."
    : "칠한 구간의 색을 기준으로, 비슷한 색만 컬러로 남깁니다.";
}

function updateColorSwatch(item) {
  if ((item?.colorKeepMode || "match") === "region") {
    el.colorSwatchLabel.textContent = item?.colorRegion?.length ? `구간 ${item.colorRegion.length}곳` : "아직 고르지 않음";
    return;
  }
  const colors = item?.keepColor?.colors;
  if (colors?.length) {
    const { r, g, b } = colors[0];
    el.colorSwatch.style.background = `rgb(${r}, ${g}, ${b})`;
    el.colorSwatchLabel.textContent = `구간 색 ${colors.length}개`;
  } else {
    el.colorSwatch.style.background = "";
    el.colorSwatchLabel.textContent = "아직 고르지 않음";
  }
}

function canvasPoint(event) {
  const canvas = el.editorCanvas;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (canvas.width / rect.width);
  const y = (event.clientY - rect.top) * (canvas.height / rect.height);
  return {
    x: Math.max(0, Math.min(canvas.width - 1, x)),
    y: Math.max(0, Math.min(canvas.height - 1, y)),
    nx: canvas.width ? x / canvas.width : 0,
    ny: canvas.height ? y / canvas.height : 0,
  };
}

let previewRaf = 0;
function schedulePreview() {
  if (previewRaf) return;
  previewRaf = requestAnimationFrame(() => {
    previewRaf = 0;
    updateEditorPreview();
  });
}

function nearEnough(a, b, min = 0.00012) {
  const dx = a.nx - b.nx;
  const dy = a.ny - b.ny;
  return dx * dx + dy * dy < min;
}

function eraseMarks(marks, point, radius) {
  return (marks || []).filter((mark) => {
    const dx = (mark.nx - point.nx) / radius;
    const dy = (mark.ny - point.ny) / radius;
    return dx * dx + dy * dy > 1;
  });
}

function paintMosaicAt(point) {
  const item = currentItem();
  if (!item) return;
  if (!item.mosaicMarks) item.mosaicMarks = [];
  if (state.mosaicAction === "erase") {
    const canvas = el.editorCanvas;
    const block = mosaicBlock(canvas.width, canvas.height, state.mosaicSize);
    const radius = (block * 2.6) / Math.min(canvas.width, canvas.height);
    const next = eraseMarks(item.mosaicMarks, point, radius);
    if (next.length === item.mosaicMarks.length) return;
    item.mosaicMarks = next;
    schedulePreview();
    return;
  }
  const last = item.mosaicMarks[item.mosaicMarks.length - 1];
  if (last && last.kind === state.mosaicSize && nearEnough(last, point)) return;
  item.mosaicMarks.push({ nx: point.nx, ny: point.ny, kind: state.mosaicSize });
  const ctx = el.editorCanvas.getContext("2d", { willReadFrequently: true });
  mosaicBrush(ctx, point.x, point.y, state.mosaicSize);
}

function paintColorRegionAt(point) {
  const item = currentItem();
  if (!item) return;
  if (!item.colorRegion) item.colorRegion = [];
  const canvas = el.editorCanvas;
  const radius = regionRadius(canvas.width, canvas.height) / Math.min(canvas.width, canvas.height);
  if (state.colorAction === "erase") {
    const next = eraseMarks(item.colorRegion, point, radius * 1.2);
    if (next.length === item.colorRegion.length) return;
    item.colorRegion = next;
    state.needsColorRebuild = true;
    schedulePreview();
    return;
  }
  const last = item.colorRegion[item.colorRegion.length - 1];
  if (last && nearEnough(last, point)) return;
  item.colorRegion.push({ nx: point.nx, ny: point.ny });
  state.needsColorRebuild = true;
  const ctx = el.editorCanvas.getContext("2d");
  ctx.fillStyle = "rgba(255, 196, 0, 0.32)";
  ctx.beginPath();
  ctx.arc(point.x, point.y, regionRadius(canvas.width, canvas.height), 0, Math.PI * 2);
  ctx.fill();
}

function finishColorStroke() {
  const item = currentItem();
  if (!item || !state.needsColorRebuild) return;
  rebuildKeepColor(item);
  state.needsColorRebuild = false;
  updateEditorPreview();
}

el.toolGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  state.tool = btn.dataset.tool;
  syncToolUi();
  updateEditorPreview();
});

el.mosaicSizeGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  state.mosaicSize = btn.dataset.size;
  syncToolUi();
});

el.mosaicActionGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  state.mosaicAction = btn.dataset.action;
  syncToolUi();
});

el.colorActionGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  state.colorAction = btn.dataset.action;
  syncToolUi();
});

el.colorModeGroup.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  const item = currentItem();
  state.colorKeepMode = btn.dataset.mode;
  if (item) {
    item.colorKeepMode = state.colorKeepMode;
    if (state.colorKeepMode === "match") rebuildKeepColor(item);
  }
  syncToolUi();
  updateEditorPreview();
});

el.clearColorBtn.addEventListener("click", () => {
  const item = currentItem();
  if (!item) return;
  item.colorRegion = [];
  item.keepColor = null;
  updateEditorPreview();
});

el.colorTolSlider.addEventListener("input", () => {
  el.colorTolVal.textContent = el.colorTolSlider.value;
  const item = currentItem();
  if (!item?.colorRegion?.length) return;
  if ((item.colorKeepMode || "match") === "region") return;
  if (item.keepColor) item.keepColor.tolerance = Number(el.colorTolSlider.value);
  else rebuildKeepColor(item);
  updateEditorPreview();
});

el.editorCanvas.addEventListener("pointerdown", (e) => {
  if (state.view !== "editor") return;
  e.preventDefault();
  const point = canvasPoint(e);
  if (state.tool === "mosaic") {
    state.drawing = true;
    el.editorCanvas.setPointerCapture(e.pointerId);
    paintMosaicAt(point);
  } else if (state.tool === "color") {
    state.drawing = true;
    el.editorCanvas.setPointerCapture(e.pointerId);
    paintColorRegionAt(point);
  }
});

el.editorCanvas.addEventListener("pointermove", (e) => {
  if (!state.drawing) return;
  const point = canvasPoint(e);
  if (state.tool === "mosaic") paintMosaicAt(point);
  if (state.tool === "color") paintColorRegionAt(point);
});

function stopDraw() {
  const wasDrawing = state.drawing;
  state.drawing = false;
  if (wasDrawing && state.tool === "color") finishColorStroke();
}
el.editorCanvas.addEventListener("pointerup", stopDraw);
el.editorCanvas.addEventListener("pointercancel", stopDraw);
el.editorCanvas.addEventListener("pointerleave", stopDraw);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function u16(n) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, n, true); return b; }
function u32(n) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, true); return b; }

function concat(parts) {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let offset = 0;
  parts.forEach((p) => { out.set(p, offset); offset += p.length; });
  return out;
}

async function createZip(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name.replaceAll("\\", "/"));
    const data = new Uint8Array(await file.blob.arrayBuffer());
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length), u16(0), nameBytes, data,
    ]);
    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(nameBytes.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralDir = concat(centrals);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralDir.length), u32(offset), u16(0),
  ]);
  return new Blob([concat([...locals, centralDir, end])], { type: "application/zip" });
}
