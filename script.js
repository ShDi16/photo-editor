// Вставьте ваш ключ Remove.bg между кавычек ниже
const REMOVE_BG_API_KEY = "ВАШ_API_КЛЮЧ_REMOVE_BG";

let cropper = null;
const imageElement = document.getElementById('image');
const uploadInput = document.getElementById('uploadInput');

// Загрузка изображения в редактор
uploadInput.addEventListener('change', (e) => {
  const files = e.target.files;
  if (files && files.length > 0) {
    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = (event) => {
      imageElement.src = event.target.result;
      imageElement.style.display = 'block';

      // Уничтожаем старый cropper при повторной загрузке
      if (cropper) {
        cropper.destroy();
      }

      // Инициализация Cropper.js
      cropper = new Cropper(imageElement, {
        viewMode: 1,
        autoCropArea: 1,
      });
    };
    reader.readAsDataURL(file);
  }
});

// Кнопки кадрирования
document.getElementById('btnSquare').addEventListener('click', () => {
  if (cropper) cropper.setAspectRatio(1 / 1);
});

document.getElementById('btnFashion').addEventListener('click', () => {
  if (cropper) cropper.setAspectRatio(3 / 4);
});

document.getElementById('btnLandscape').addEventListener('click', () => {
  if (cropper) cropper.setAspectRatio(4 / 3);
});

document.getElementById('btnFree').addEventListener('click', () => {
  if (cropper) cropper.setAspectRatio(NaN);
});

// Удаление фона через Remove.bg API
document.getElementById('btnRemoveBg').addEventListener('click', async () => {
  if (!cropper) {
    alert('Сначала загрузите изображение!');
    return;
  }

  if (!REMOVE_BG_API_KEY || REMOVE_BG_API_KEY === "ВАШ_API_КЛЮЧ_REMOVE_BG") {
    alert('Пожалуйста, укажите ваш API-ключ Remove.bg в файле script.js');
    return;
  }

  // Получаем кадрированный файл
  cropper.getCroppedCanvas().toBlob(async (blob) => {
    const formData = new FormData();
    formData.append('image_file', blob);
    formData.append('size', 'auto');

    try {
      const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': REMOVE_BG_API_KEY
        },
        body: formData
      });

      if (response.ok) {
        const resultBlob = await response.blob();
        const newUrl = URL.createObjectURL(resultBlob);
        
        cropper.replace(newUrl);
      } else {
        alert('Ошибка при удалении фона. Проверьте ваш API ключ.');
      }
    } catch (error) {
      console.error(error);
      alert('Сетевая ошибка при обращении к сервису.');
    }
  });
});

// Скачивание готового файла
document.getElementById('btnDownload').addEventListener('click', () => {
  if (!cropper) return;
  
  const canvas = cropper.getCroppedCanvas();
  const link = document.createElement('a');
  link.download = 'edited-photo.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});