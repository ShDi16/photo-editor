import { translations } from './i18n.js';

let currentLang = localStorage.getItem('lang') || 'ru';
const t = (key) => translations[currentLang][key] || key;

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.documentElement.lang = currentLang;
  localStorage.setItem('lang', currentLang);
  const langRU = document.getElementById('langRU');
  const langEN = document.getElementById('langEN');
  if (langRU) langRU.classList.toggle('active', currentLang === 'ru');
  if (langEN) langEN.classList.toggle('active', currentLang === 'en');
}

const langRU = document.getElementById('langRU');
const langEN = document.getElementById('langEN');
if (langRU) langRU.onclick = () => { currentLang = 'ru'; applyLang(); };
if (langEN) langEN.onclick = () => { currentLang = 'en'; applyLang(); };
applyLang();

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const dropZone = document.getElementById('dropZone');
const editor = document.getElementById('editor');
const canvas = document.getElementById('canvas');
const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;
const cropOverlay = document.getElementById('cropOverlay');
const brightness = document.getElementById('brightness');
const contrast = document.getElementById('contrast');
const cropBtn = document.getElementById('cropBtn');
const applyCropBtn = document.getElementById('applyCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const bgRemoveBtn = document.getElementById('bgRemoveBtn');
const enhanceBtn = document.getElementById('enhanceBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const newPhotoBtn = document.getElementById('newPhotoBtn');
const ratio11 = document.getElementById('ratio11');
const ratio34 = document.getElementById('ratio34');
const ratio45 = document.getElementById('ratio45');
const bgLightBtn = document.getElementById('bgLightBtn');
const bgDarkBtn = document.getElementById('bgDarkBtn');
const canvasWrap = document.querySelector('.canvas-wrap');

let originalImage = null;
let baseImageData = null;
let isCropping = false;
let cropRect = null; // {x, y, w, h} в координатах canvas
let activeRatio = null; // {w, h} или null
let dragMode = null; // 'draw' | 'move'
let dragStart = null;
let rectStart = null;

if (uploadBtn && fileInput) {
  uploadBtn.onclick = () => fileInput.click();
  fileInput.onchange = e => loadFile(e.target.files[0]);
}

if (dropZone) {
  dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('drag'); };
  dropZone.ondragleave = () => dropZone.classList.remove('drag');
  dropZone.ondrop = e => {
    e.preventDefault();
    dropZone.classList.remove('drag');
    loadFile(e.dataTransfer.files[0]);
  };
}

function loadFile(file) {
  if (!file || !file.type.startsWith('image/') || !canvas || !ctx) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      const max = 1200;
      let w = img.width, h = img.height;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max; }
        else { w = Math.round(w * max / h); h = max; }
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      baseImageData = ctx.getImageData(0, 0, w, h);
      if (editor) editor.hidden = false;
      if (dropZone) dropZone.hidden = true;
      resetSliders();
      endCropMode();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function applyFilters() {
  if (!baseImageData || !ctx) return;
  const data = new ImageData(new Uint8ClampedArray(baseImageData.data), baseImageData.width, baseImageData.height);
  const b = +brightness.value;
  const c = +contrast.value;
  const factor = (259 * (c + 255)) / (255 * (259 - c));
  for (let i = 0; i < data.data.length; i += 4) {
    let r = data.data[i] + b;
    let g = data.data[i + 1] + b;
    let bl = data.data[i + 2] + b;
    r = factor * (r - 128) + 128;
    g = factor * (g - 128) + 128;
    bl = factor * (bl - 128) + 128;
    data.data[i] = Math.max(0, Math.min(255, r));
    data.data[i + 1] = Math.max(0, Math.min(255, g));
    data.data[i + 2] = Math.max(0, Math.min(255, bl));
  }
  ctx.putImageData(data, 0, 0);
}

if (brightness) brightness.oninput = applyFilters;
if (contrast) contrast.oninput = applyFilters;

function resetSliders() {
  if (brightness) brightness.value = 0;
  if (contrast) contrast.value = 0;
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX)),
    y: Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY)),
    scaleX,
    scaleY,
    rect
  };
}

function updateOverlay() {
  if (!cropOverlay || !cropRect) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  cropOverlay.hidden = false;
  cropOverlay.style.left = (cropRect.x / scaleX) + 'px';
  cropOverlay.style.top = (cropRect.y / scaleY) + 'px';
  cropOverlay.style.width = (cropRect.w / scaleX) + 'px';
  cropOverlay.style.height = (cropRect.h / scaleY) + 'px';
}

function startCropMode(ratio = null) {
  if (!canvas) return;
  isCropping = true;
  activeRatio = ratio;
  cropBtn.hidden = true;
  if (applyCropBtn) applyCropBtn.hidden = false;
  if (cancelCropBtn) cancelCropBtn.hidden = false;

  // стартовая рамка по центру
  const target = ratio ? ratio.w / ratio.h : 1;
  let w, h;
  if (!ratio) {
    w = Math.round(canvas.width * 0.7);
    h = Math.round(canvas.height * 0.7);
  } else if (canvas.width / canvas.height > target) {
    h = Math.round(canvas.height * 0.8);
    w = Math.round(h * target);
  } else {
    w = Math.round(canvas.width * 0.8);
    h = Math.round(w / target);
  }
  cropRect = {
    x: Math.round((canvas.width - w) / 2),
    y: Math.round((canvas.height - h) / 2),
    w,
    h
  };
  updateOverlay();
}

function endCropMode() {
  isCropping = false;
  activeRatio = null;
  dragMode = null;
  cropRect = null;
  if (cropOverlay) {
    cropOverlay.hidden = true;
    cropOverlay.style.cssText = '';
  }
  if (cropBtn) cropBtn.hidden = false;
  if (applyCropBtn) applyCropBtn.hidden = true;
  if (cancelCropBtn) cancelCropBtn.hidden = true;
}

if (cropBtn) cropBtn.onclick = () => startCropMode(null);
if (cancelCropBtn) cancelCropBtn.onclick = endCropMode;

if (ratio11) ratio11.onclick = () => startCropMode({ w: 1, h: 1 });
if (ratio34) ratio34.onclick = () => startCropMode({ w: 3, h: 4 });
if (ratio45) ratio45.onclick = () => startCropMode({ w: 4, h: 5 });

if (applyCropBtn) {
  applyCropBtn.onclick = () => {
    if (!cropRect || cropRect.w < 10 || cropRect.h < 10 || !ctx) return;
    const { x, y, w, h } = cropRect;
    const cropped = ctx.getImageData(x, y, w, h);
    canvas.width = w;
    canvas.height = h;
    ctx.putImageData(cropped, 0, 0);
    baseImageData = ctx.getImageData(0, 0, w, h);
    endCropMode();
    resetSliders();
  };
}

if (canvas) {
  canvas.addEventListener('mousedown', e => {
    if (!isCropping) return;
    const p = getCanvasPoint(e);

    // если клик внутри рамки — двигаем, иначе рисуем новую
    if (cropRect &&
        p.x >= cropRect.x && p.x <= cropRect.x + cropRect.w &&
        p.y >= cropRect.y && p.y <= cropRect.y + cropRect.h) {
      dragMode = 'move';
      dragStart = { x: p.x, y: p.y };
      rectStart = { ...cropRect };
    } else if (!activeRatio) {
      dragMode = 'draw';
      dragStart = { x: p.x, y: p.y };
      cropRect = { x: p.x, y: p.y, w: 1, h: 1 };
      updateOverlay();
    } else {
      // при фиксированном ratio клик вне рамки тоже двигает
      dragMode = 'move';
      dragStart = { x: p.x, y: p.y };
      rectStart = { ...cropRect };
    }
  });

  window.addEventListener('mousemove', e => {
    if (!isCropping || !dragMode || !dragStart) return;
    const p = getCanvasPoint(e);

    if (dragMode === 'draw') {
      const x1 = dragStart.x;
      const y1 = dragStart.y;
      const x2 = p.x;
      const y2 = p.y;
      cropRect = {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        w: Math.abs(x2 - x1),
        h: Math.abs(y2 - y1)
      };
      updateOverlay();
    }

    if (dragMode === 'move' && rectStart) {
      let nx = rectStart.x + (p.x - dragStart.x);
      let ny = rectStart.y + (p.y - dragStart.y);
      nx = Math.max(0, Math.min(canvas.width - rectStart.w, nx));
      ny = Math.max(0, Math.min(canvas.height - rectStart.h, ny));
      cropRect = { x: nx, y: ny, w: rectStart.w, h: rectStart.h };
      updateOverlay();
    }
  });

  window.addEventListener('mouseup', () => {
    dragMode = null;
    dragStart = null;
    rectStart = null;
  });
}

// ===== Фон =====
if (bgLightBtn && canvasWrap) {
  bgLightBtn.onclick = () => {
    canvasWrap.classList.add('bg-light');
    canvasWrap.classList.remove('bg-dark');
  };
}
if (bgDarkBtn && canvasWrap) {
  bgDarkBtn.onclick = () => {
    canvasWrap.classList.add('bg-dark');
    canvasWrap.classList.remove('bg-light');
  };
}

if (bgRemoveBtn) {
  bgRemoveBtn.onclick = () => {
    alert(currentLang === 'ru'
      ? 'Удаление фона временно в разработке. Скоро вернём.'
      : 'Background removal is temporarily unavailable.');
  };
}

if (enhanceBtn) {
  enhanceBtn.onclick = () => {
    if (!baseImageData || !ctx) return;
    enhanceBtn.disabled = true;
    enhanceBtn.textContent = t('processing') || 'Обрабатываем…';

    const data = new ImageData(new Uint8ClampedArray(baseImageData.data), baseImageData.width, baseImageData.height);
    const contrastValue = 25;
    const brightnessValue = 8;
    const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));

    for (let i = 0; i < data.data.length; i += 4) {
      let r = data.data[i] + brightnessValue;
      let g = data.data[i + 1] + brightnessValue;
      let b = data.data[i + 2] + brightnessValue;
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * 1.15;
      g = avg + (g - avg) * 1.15;
      b = avg + (b - avg) * 1.15;
      data.data[i] = Math.max(0, Math.min(255, r));
      data.data[i + 1] = Math.max(0, Math.min(255, g));
      data.data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(data, 0, 0);
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    resetSliders();
    enhanceBtn.textContent = t('enhanceDone') || 'Фото улучшено';
    setTimeout(() => {
      enhanceBtn.textContent = t('enhance') || 'Улучшить фото';
      enhanceBtn.disabled = false;
    }, 1200);
  };
}

if (resetBtn) {
  resetBtn.onclick = () => {
    if (!originalImage || !canvas || !ctx) return;
    const max = 1200;
    let w = originalImage.width, h = originalImage.height;
    if (w > max || h > max) {
      if (w > h) { h = Math.round(h * max / w); w = max; }
      else { w = Math.round(w * max / h); h = max; }
    }
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(originalImage, 0, 0, w, h);
    baseImageData = ctx.getImageData(0, 0, w, h);
    resetSliders();
    endCropMode();
  };
}

if (downloadBtn) {
  downloadBtn.onclick = () => {
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'edited-photo.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
}

if (newPhotoBtn) {
  newPhotoBtn.onclick = () => {
    if (editor) editor.hidden = true;
    if (dropZone) dropZone.hidden = false;
    originalImage = null;
    baseImageData = null;
    endCropMode();
    resetSliders();
    if (fileInput) fileInput.value = '';
  };
}
