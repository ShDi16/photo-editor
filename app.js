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

if (uploadBtn) uploadBtn.onclick = () => fileInput && fileInput.click();
if (fileInput) fileInput.onchange = e => loadFile(e.target.files[0]);

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
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      const max = 1400;
      let w = img.width, h = img.height;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * max / w); w = max
