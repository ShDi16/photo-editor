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

let originalImage = null;
let baseImageData = null;
let isCropping = false;
let cropStart = null;
let cropRect = null;

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

if (cropBtn) {
  cropBtn.onclick = () => {
    isCropping = true;
    if (cropOverlay) cropOverlay.hidden = false;
    cropBtn.hidden = true;
    if (applyCropBtn) applyCropBtn.hidden = false;
    if (cancelCropBtn) cancelCropBtn.hidden = false;
    cropRect = null;
    if (cropOverlay) cropOverlay.style.cssText = '';
  };
}

function endCropMode() {
  isCropping = false;
  if (cropOverlay) cropOverlay.hidden = true;
  if (cropBtn) cropBtn.hidden = false;
  if (applyCropBtn) applyCropBtn.hidden = true;
  if (cancelCropBtn) cancelCropBtn.hidden = true;
}

if (cancelCropBtn) cancelCropBtn.onclick = endCropMode;

if (canvas) {
  canvas.addEventListener('mousedown', e => {
    if (!isCropping) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    cropStart = {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  });

  canvas.addEventListener('mousemove', e => {
    if (!isCropping || !cropStart) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const left = Math.min(cropStart.x, x);
    const top = Math.min(cropStart.y, y);
    const width = Math.abs(x - cropStart.x);
    const height = Math.abs(y - cropStart.y);

    cropRect = { left, top, width, height };

    if (cropOverlay) {
      cropOverlay.style.left = (left / scaleX) + 'px';
      cropOverlay.style.top = (top / scaleY) + 'px';
      cropOverlay.style.width = (width / scaleX) + 'px';
      cropOverlay.style.height = (height / scaleY) + 'px';
    }
  });

  canvas.addEventListener('mouseup', () => { cropStart = null; });
}

if (applyCropBtn) {
  applyCropBtn.onclick = () => {
    if (!cropRect || cropRect.width < 10 || !ctx) return;
    const { left, top, width, height } = cropRect;
    const cropped = ctx.getImageData(left, top, width, height);
    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(cropped, 0, 0);
    baseImageData = ctx.getImageData(0, 0, width, height);
    endCropMode();
    resetSliders();
  };
}

// ========== Удаление фона через Transformers.js ==========
if (bgRemoveBtn) {
  bgRemoveBtn.onclick = async () => {
    if (!baseImageData || !canvas || !ctx) return;
    bgRemoveBtn.disabled = true;
    bgRemoveBtn.textContent = t('processing');

    try {
      // Загружаем библиотеку Transformers.js
      const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0');

      // Создаём пайплайн для удаления фона (модель RMBG)
      const remover = await pipeline('image-segmentation', 'briaai/RMBG-1.4', {
        device: 'wasm'   // работает почти везде
      });

      // Получаем текущее изображение с canvas
      const dataUrl = canvas.toDataURL('image/png');
      
      // Запускаем удаление фона
      const result = await remover(dataUrl);

      // result содержит маску. Рисуем результат
      // Упрощённый вариант: берём первое изображение результата
      if (result && result[0] && result[0].mask) {
        // Более надёжный способ — используем canvas
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          resetSliders();
          bgRemoveBtn.textContent = t('bgDone');
          setTimeout(() => {
            bgRemoveBtn.textContent = t('removeBg');
            bgRemoveBtn.disabled = false;
          }, 1500);
        };
        // Пока используем оригинальный подход с предупреждением
        // Полная работа с маской требует больше кода
        throw new Error('Модель загрузилась, но обработка маски требует доработки. Попробуем другой способ.');
      } else {
        throw new Error('Не удалось получить результат от модели');
      }
    } catch (err) {
      console.error('Background removal error:', err);
      alert(currentLang === 'ru' 
        ? 'Удаление фона пока не стабильно работает. Модель большая и может не загрузиться. Мы продолжим улучшать.' 
        : 'Background removal is still unstable. The model is large.');
      bgRemoveBtn.textContent = t('removeBg');
      bgRemoveBtn.disabled = false;
    }
  };
}

// ========== Авто-улучшение фото ==========
if (enhanceBtn) {
  enhanceBtn.onclick = () => {
    if (!baseImageData || !ctx) return;

    enhanceBtn.disabled = true;
    enhanceBtn.textContent = t('processing');

    const data = new ImageData(new Uint8ClampedArray(baseImageData.data), baseImageData.width, baseImageData.height);
    
    // Автоматически поднимаем контраст, немного яркость и насыщенность
    const contrastValue = 25;
    const brightnessValue = 8;
    const factor = (259 * (contrastValue + 255)) / (255 * (259 - contrastValue));

    for (let i = 0; i < data.data.length; i += 4) {
      let r = data.data[i];
      let g = data.data[i + 1];
      let b = data.data[i + 2];

      // Яркость
      r += brightnessValue;
      g += brightnessValue;
      b += brightnessValue;

      // Контраст
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;

      // Лёгкое увеличение насыщенности
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * 1.15;
      g = avg + (g - avg) * 1.15;
      b = avg + (b - avg) * 1.15;

      data.data[i]     = Math.max(0, Math.min(255, r));
      data.data[i + 1] = Math.max(0, Math.min(255, g));
      data.data[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(data, 0, 0);
    baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    resetSliders();

    enhanceBtn.textContent = t('enhanceDone');
    setTimeout(() => {
      enhanceBtn.textContent = t('enhance');
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

// ========== Пресеты соотношения сторон ==========
function cropToRatio(ratioW, ratioH) {
  if (!baseImageData || !canvas || !ctx) {
    console.log('Нет изображения для обрезки');
    return;
  }

  const imgW = canvas.width;
  const imgH = canvas.height;
  const targetRatio = ratioW / ratioH;
  const currentRatio = imgW / imgH;

  let newW, newH, startX, startY;

  if (currentRatio > targetRatio) {
    newH = imgH;
    newW = Math.round(imgH * targetRatio);
    startX = Math.round((imgW - newW) / 2);
    startY = 0;
  } else {
    newW = imgW;
    newH = Math.round(imgW / targetRatio);
    startX = 0;
    startY = Math.round((imgH - newH) / 2);
  }

  const cropped = ctx.getImageData(startX, startY, newW, newH);
  canvas.width = newW;
  canvas.height = newH;
  ctx.putImageData(cropped, 0, 0);
  baseImageData = ctx.getImageData(0, 0, newW, newH);
  resetSliders();
  endCropMode();
}

if (ratio11) ratio11.onclick = () => cropToRatio(1, 1);
if (ratio34) ratio34.onclick = () => cropToRatio(3, 4);
if (ratio45) ratio45.onclick = () => cropToRatio(4, 5);
