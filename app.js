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
const circleBtn = document.getElementById('circleBtn');
const roundBtn = document.getElementById('roundBtn');
const canvasWrap = document.querySelector('.canvas-wrap');

let originalImage = null;
let baseImageData = null;
let padColor = '#0a0c10';

let isCropping = false;
let cropRect = null;
let dragMode = null;
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
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

function clampCropRect(r) {
  let w = Math.max(10, r.w);
  let h = Math.max(10, r.h);
  if (w > canvas.width) w = canvas.width;
  if (h > canvas.height) h = canvas.height;
  const x = Math.max(0, Math.min(r.x, canvas.width - w));
  const y = Math.max(0, Math.min(r.y, canvas.height - h));
  return { x, y, w, h };
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

function startCropMode() {
  if (!canvas) return;
  isCropping = true;
  if (cropBtn) cropBtn.hidden = true;
  if (applyCropBtn) applyCropBtn.hidden = false;
  if (cancelCropBtn) cancelCropBtn.hidden = false;

  const w = Math.round(canvas.width * 0.7);
  const h = Math.round(canvas.height * 0.7);
  cropRect = clampCropRect({
    x: Math.round((canvas.width - w) / 2),
    y: Math.round((canvas.height - h) / 2),
    w,
    h
  });
  updateOverlay();
}

function endCropMode() {
  isCropping = false;
  dragMode = null;
  dragStart = null;
  rectStart = null;
  cropRect = null;
  if (cropOverlay) {
    cropOverlay.hidden = true;
    cropOverlay.style.left = '';
    cropOverlay.style.top = '';
    cropOverlay.style.width = '';
    cropOverlay.style.height = '';
  }
  if (cropBtn) cropBtn.hidden = false;
  if (applyCropBtn) applyCropBtn.hidden = true;
  if (cancelCropBtn) cancelCropBtn.hidden = true;
}

if (cropBtn) cropBtn.onclick = startCropMode;
if (cancelCropBtn) cancelCropBtn.onclick = endCropMode;

if (applyCropBtn) {
  applyCropBtn.onclick = () => {
    if (!cropRect || !ctx) return;
    const r = clampCropRect(cropRect);
    const cropped = ctx.getImageData(Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h));
    canvas.width = Math.round(r.w);
    canvas.height = Math.round(r.h);
    ctx.putImageData(cropped, 0, 0);
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    endCropMode();
    resetSliders();
  };
}

function onCropPointerDown(e) {
  if (!isCropping || !canvas) return;
  e.preventDefault();
  const p = getCanvasPoint(e);
  const inside = cropRect &&
    p.x >= cropRect.x && p.x <= cropRect.x + cropRect.w &&
    p.y >= cropRect.y && p.y <= cropRect.y + cropRect.h;

  if (inside) {
    dragMode = 'move';
    dragStart = { x: p.x, y: p.y };
    rectStart = { ...cropRect };
  } else {
    dragMode = 'draw';
    dragStart = { x: p.x, y: p.y };
    cropRect = { x: p.x, y: p.y, w: 1, h: 1 };
    updateOverlay();
  }
}

function onCropPointerMove(e) {
  if (!isCropping || !dragMode || !dragStart) return;
  const p = getCanvasPoint(e);

  if (dragMode === 'draw') {
    cropRect = clampCropRect({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y)
    });
    updateOverlay();
  }

  if (dragMode === 'move' && rectStart) {
    cropRect = clampCropRect({
      x: rectStart.x + (p.x - dragStart.x),
      y: rectStart.y + (p.y - dragStart.y),
      w: rectStart.w,
      h: rectStart.h
    });
    updateOverlay();
  }
}

function onCropPointerUp() {
  dragMode = null;
  dragStart = null;
  rectStart = null;
}

if (canvas) canvas.addEventListener('mousedown', onCropPointerDown);
if (cropOverlay) cropOverlay.addEventListener('mousedown', onCropPointerDown);
window.addEventListener('mousemove', onCropPointerMove);
window.addEventListener('mouseup', onCropPointerUp);

// ===== Формат без обрезки (поля) =====
function fitToRatio(ratioW, ratioH) {
  if (!baseImageData || !canvas || !ctx) return;

  const srcW = canvas.width;
  const srcH = canvas.height;
  const targetRatio = ratioW / ratioH;
  const srcRatio = srcW / srcH;

  let outW, outH;
  if (srcRatio > targetRatio) {
    outW = srcW;
    outH = Math.round(srcW / targetRatio);
  } else {
    outH = srcH;
    outW = Math.round(srcH * targetRatio);
  }

  const temp = document.createElement('canvas');
  temp.width = srcW;
  temp.height = srcH;
  temp.getContext('2d').putImageData(baseImageData, 0, 0);

  canvas.width = outW;
  canvas.height = outH;
  ctx.fillStyle = padColor;
  ctx.fillRect(0, 0, outW, outH);

  const x = Math.round((outW - srcW) / 2);
  const y = Math.round((outH - srcH) / 2);
  ctx.drawImage(temp, x, y);

  baseImageData = ctx.getImageData(0, 0, outW, outH);
  resetSliders();
  endCropMode();
}

if (ratio11) ratio11.onclick = () => fitToRatio(1, 1);
if (ratio34) ratio34.onclick = () => fitToRatio(3, 4);
if (ratio45) ratio45.onclick = () => fitToRatio(4, 5);

// ===== Фон =====
if (bgLightBtn) {
  bgLightBtn.onclick = () => {
    padColor = '#f3f4f6';
    if (canvasWrap) {
      canvasWrap.classList.add('bg-light');
      canvasWrap.classList.remove('bg-dark');
    }
  };
}
if (bgDarkBtn) {
  bgDarkBtn.onclick = () => {
    padColor = '#0a0c10';
    if (canvasWrap) {
      canvasWrap.classList.add('bg-dark');
      canvasWrap.classList.remove('bg-light');
    }
  };
}

// ===== Круг / скругление =====
function applyRoundedMask(radiusRatio) {
  if (!baseImageData || !canvas || !ctx) return;
  const w = canvas.width;
  const h = canvas.height;

  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  temp.getContext('2d').putImageData(baseImageData, 0, 0);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = padColor;
  ctx.fillRect(0, 0, w, h);

  const r = Math.min(w, h) * radiusRatio;
  ctx.save();
  ctx.beginPath();
  if (radiusRatio >= 0.49) {
    ctx.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
  } else {
    ctx.moveTo(r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
  }
  ctx.clip();
  ctx.drawImage(temp, 0, 0);
  ctx.restore();

  baseImageData = ctx.getImageData(0, 0, w, h);
  resetSliders();
}

if (circleBtn) circleBtn.onclick = () => applyRoundedMask(0.5);
if (roundBtn) roundBtn.onclick = () => applyRoundedMask(0.12);

if (bgRemoveBtn) {
  bgRemoveBtn.onclick = () => {
    alert(currentLang === 'ru'
      ? 'Удаление фона временно в разработке.'
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
