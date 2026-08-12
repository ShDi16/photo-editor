if (bgRemoveBtn) {
  bgRemoveBtn.onclick = async () => {
    if (!baseImageData || !canvas || !ctx) return;

    bgRemoveBtn.disabled = true;
    const oldText = bgRemoveBtn.textContent;
    bgRemoveBtn.textContent = t('loadingModel') || 'Загрузка модели…';

    try {
      // Загружаем Transformers.js
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0');
      
      // Работаем в браузере через WASM
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      bgRemoveBtn.textContent = t('processing') || 'Обрабатываем…';

      // Лёгкая модель для удаления фона
      const segmenter = await pipeline(
        'image-segmentation',
        'Xenova/modnet',
        { device: 'wasm' }
      );

      // Текущее фото с canvas
      const dataUrl = canvas.toDataURL('image/png');

      // Получаем маску
      const result = await segmenter(dataUrl);

      if (!result || !result[0] || !result[0].mask) {
        throw new Error('Маска не получена');
      }

      const mask = result[0].mask; // { data, width, height }

      // Рисуем результат с прозрачным фоном
      const out = ctx.createImageData(canvas.width, canvas.height);
      const src = baseImageData.data;
      const maskData = mask.data;

      // Маска может быть другого размера — масштабируем простым способом
      const scaleX = mask.width / canvas.width;
      const scaleY = mask.height / canvas.height;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const mx = Math.min(mask.width - 1, Math.floor(x * scaleX));
          const my = Math.min(mask.height - 1, Math.floor(y * scaleY));
          const mi = my * mask.width + mx;

          // В MODNet обычно 1 = человек/объект, 0 = фон
          const alpha = maskData[mi] > 0.5 ? 255 : 0;

          out.data[i]     = src[i];
          out.data[i + 1] = src[i + 1];
          out.data[i + 2] = src[i + 2];
          out.data[i + 3] = alpha;
        }
      }

      ctx.putImageData(out, 0, 0);
      baseImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resetSliders();

      bgRemoveBtn.textContent = t('bgDone') || 'Фон удалён';
      setTimeout(() => {
        bgRemoveBtn.textContent = t('removeBg') || 'Удалить фон';
        bgRemoveBtn.disabled = false;
      }, 1500);

    } catch (err) {
      console.error('Background removal error:', err);
      alert(t('bgError') || 'Не удалось удалить фон. Попробуйте другое фото или обновите страницу.');
      bgRemoveBtn.textContent = t('removeBg') || 'Удалить фон';
      bgRemoveBtn.disabled = false;
    }
  };
}
