window.addEventListener('load', () => {
  setTimeout(() => {
    const container = document.getElementById('ad-slot-bottom');
    if (!container) {
      console.log('Рекламный блок не найден');
      return;
    }

    // Принудительно делаем контейнер видимым
    container.style.display = 'block';
    container.style.visibility = 'visible';
    container.style.opacity = '1';
    container.style.minHeight = '250px';
    container.style.width = '100%';

    (function(w, d, n, s, t) {
      w[n] = w[n] || [];
      w[n].push(function() {
        Ya.Context.AdvManager.render({
          blockId: 'R-A-19741270-1',
          renderTo: 'ad-slot-bottom',
          async: true
        });
      });
      t = d.getElementsByTagName('script')[0];
      s = d.createElement('script');
      s.type = 'text/javascript';
      s.src = 'https://an.yandex.ru/system/context.js';
      s.async = true;
      t.parentNode.insertBefore(s, t);
    })(this, this.document, 'yandexContextAsyncCallbacks');
  }, 2000); // ждём 2 секунды после загрузки страницы
});
