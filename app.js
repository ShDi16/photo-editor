import { translations } from './i18n.js';

let currentLang = localStorage.getItem('lang') || 'ru';
const t = (key) => translations[currentLang][key] || key;

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.documentElement.lang = currentLang;
  localStorage.setItem('lang', currentLang);
  document.getElementById('langRU').classList.toggle('active', currentLang === 'ru');
  document.getElementById('langEN').classList.toggle('active', currentLang === 'en');
}

document.getElementById('langRU').onclick = () => { currentLang = 'ru'; applyLang(); };
document.getElementById('langEN').onclick = () => { currentLang = 'en'; applyLang(); };
applyLang();

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const dropZone = document.getElementById('dropZone');
const editor = document.getElementById('editor');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const cropOverlay = document.getElementById('cropOverlay');
const brightness = document.getElementById('brightness');
const contrast = document.getElementById('contrast');
const cropBtn = document.getElementById('cropBtn');
const applyCropBtn = document.getElementById('applyCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');
const bgRemoveBtn = document.getElementById('bgRemoveBtn');
const resetBtn = document.getElementById('resetBtn');
const downloadBtn = document.getElementById('downloadBtn');
const newPhotoBtn = document.getElementById('newPhotoBtn');

let originalImage = null;
let baseImageData = null;
let isCropping = false;
let cropStart = null;
let cropRect = null;

uploadBtn.onclick = () => fileInput.click();
fileInput.onchange = e => loadFile(e.target.files[0]);
dropZone.ondragover = e => { e.preventDefault(); dropZone.classList.add('drag'); };
dropZone.ondragleave = () => dropZone.classList.remove('drag');
dropZone.ondrop = e => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  loadFile(e.dataTransfer.files[0]);
};

function loadFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      const max = 1400;
      let w = img.width, h = img.height;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max; }
        else { w = Math.round(w * max / h); h = max; }
      }
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      baseImageData = ctx.getImageData(0, 0, w, h);
      editor.hidden = false;
      dropZone.hidden = true;
      resetSliders();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function applyFilters() {
  if (!baseImageData) return;
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
    data.data[i]     = Math.max(0, Math.min(255, r));
    data.data[i + 1] = Math.max(0, Math.min(255, g));
    data.data[i + 2] = Math.max(0, Math.min(255, bl));
  }
  ctx.putImageData(data, 0, 0);
}

brightness.oninput = contrast.oninput = applyFilters;

function resetSliders() {
  brightness.value = 0;
  contrast.value = 0;
}

cropBtn.onclick = () => {
  isCropping = true;
  cropOverlay.hidden = false;
  cropBtn.hidden = true;
  applyCropBtn.hidden = false;
  cancelCropBtn.hidden = false;
  cropRect = null;
  cropOverlay.style.cssText = '';
};

function endCropMode() {
  isCropping = false;
  cropOverlay.hidden = true;
  cropBtn.hidden = false;
  applyCropBtn.hidden = true;
  cancelCropBtn.hidden = true;
}

cancelCropBtn.onclick = endCropMode;

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

  cropOverlay.style.left = (left / scaleX) + 'px';
  cropOverlay.style.top = (top / scaleY) + 'px';
  cropOverlay.style.width = (width / scaleX) + 'px';
  cropOverlay.style.height = (height / scaleY) + 'px';
});

canvas.addEventListener('mouseup', () => { cropStart = null; });

applyCropBtn.onclick = () => {
  if (!cropRect || cropRect.width < 10) return;
  const { left, top, width, height } = cropRect;
  const cropped = ctx.getImageData(left, top, width, height);
  canvas.width = width;
  canvas.height = height;
  ctx.putImageData(cropped, 0, 0);
  baseImageData = ctx.getImageData(0, 0, width, height);
  endCropMode();
  resetSliders();
};

bgRemoveBtn.onclick = async () => {
  if (!baseImageData) return;
  bgRemoveBtn.disabled = true;
  bgRemoveBtn.textContent = t('processing');

  try {
    const { removeBackground } = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const resultBlob = await removeBackground(blob, {
      model: 'small',
      output: { format: 'image/png', quality: 0.9 }
    });

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
    img.src = URL.createObjectURL(resultBlob);
  } catch (err) {
    console.error(err);
    alert(currentLang === 'ru' ? 'Не удалось удалить фон. Попробуйте другое фото.' : 'Could not remove background.');
    bgRemoveBtn.textContent = t('removeBg');
    bgRemoveBtn.disabled = false;
  }
};

resetBtn.onclick = () => {
  if (!originalImage) return;
  const max = 1400;
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

downloadBtn.onclick = () => {
  const link = document.createElement('a');
  link.download = 'edited-photo.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
};

newPhotoBtn.onclick = () => {
  editor.hidden = true;
  dropZone.hidden = false;
  originalImage = null;
  baseImageData = null;
  endCropMode();
  resetSliders();
  fileInput.value = '';
};