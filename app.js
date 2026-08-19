const imageElement = document.getElementById('image');
const uploadInput = document.getElementById('uploadInput');

if (uploadInput) {
  uploadInput.addEventListener('change', (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        imageElement.src = event.target.result;
        imageElement.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
}

// Поворот
let rotation = 0;
document.getElementById('btnRotate')?.addEventListener('click', () => {
  rotation = (rotation + 90) % 360;
  imageElement.style.transform = `rotate(${rotation}deg)`;
});

// Скругление
let isRounded = false;
document.getElementById('btnRound')?.addEventListener('click', () => {
  isRounded = !isRounded;
  imageElement.style.borderRadius = isRounded ? '20px' : '0';
});

// Улучшение
let isEnhanced = false;
document.getElementById('btnEnhance')?.addEventListener('click', () => {
  isEnhanced = !isEnhanced;
  imageElement.style.filter = isEnhanced ? 'contrast(110%) brightness(105%)' : 'none';
});

// Скачивание
document.getElementById('btnDownload')?.addEventListener('click', () => {
  if (!imageElement.src) return;
  const link = document.createElement('a');
  link.download = 'photo.png';
  link.href = imageElement.src;
  link.click();
});