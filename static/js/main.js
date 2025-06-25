let priceChart, discountChart;
let currentSortField = null;
let currentSortOrder = 'asc';
let lastLoadedProducts = [];
const historyKey = 'wb_search_history';

document.addEventListener('DOMContentLoaded', () => {
  // Изменение максимальной стоимости товара
  const MAX_PRICE = 50000;

  const priceRange = document.getElementById('priceRange');
  const priceValue = document.getElementById('priceValue');
  const btnScroll = document.getElementById('btn-scroll-charts');
  const btnScrollTop = document.getElementById('btn-scroll-top');
  const btnHistory = document.getElementById('btn-history');

  priceRange.max = MAX_PRICE;
  priceRange.value = MAX_PRICE;
  priceValue.textContent = MAX_PRICE;

  priceRange.addEventListener('input', () =>
    priceValue.textContent = priceRange.value
  );

  document.getElementById('btn-parse').addEventListener('click', runParse);
  document.getElementById('btn-filter').addEventListener('click', fetchData);
  document.getElementById('searchQuery')
          .addEventListener('keydown', e => { if (e.key==='Enter') runParse(); });

  btnScroll.addEventListener('click', () =>
    document.getElementById('charts').scrollIntoView({ behavior: 'smooth' })
  );
  btnScrollTop.addEventListener('click', () =>
    window.scrollTo({ top: 0, behavior: 'smooth' })
  );
  btnHistory.addEventListener('click', showHistoryModal);

  setupSorting();
  fetchData();
});

// -------- История (модалка) --------
function addToHistory(q) {
  if (!q) return;
  let arr = JSON.parse(localStorage.getItem(historyKey) || '[]');
  arr = arr.filter(x => x !== q);
  arr.unshift(q);
  if (arr.length > 10) arr.pop();
  localStorage.setItem(historyKey, JSON.stringify(arr));
}

function showHistoryModal() {
  const arr = JSON.parse(localStorage.getItem(historyKey) || '[]');
  if (!arr.length) return showToast('История пуста');

  const overlay = document.createElement('div');
  overlay.id = 'historyModal';
  overlay.className =
    'fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 overflow-y-auto';

  const card = document.createElement('div');
  card.className = 'bg-white rounded shadow-lg w-[32rem] m-6 p-4'; 

  // Заголовок
  const header = document.createElement('h3');
  header.textContent = 'История запросов';
  header.className = 'text-lg font-semibold mb-2 text-center';
  card.appendChild(header);

  // Список
  const ul = document.createElement('ul');
  ul.className = 'space-y-1';
  arr.forEach(q => {
    const li = document.createElement('li');
    li.textContent = q;
    li.className = 'py-2 px-2 hover:bg-gray-100 cursor-pointer rounded break-words';
    li.addEventListener('click', () => {
      document.getElementById('searchQuery').value = q;
      runParse();
      closeModal();
    });
    ul.appendChild(li);
  });
  card.appendChild(ul);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal();
  });

  window.addEventListener('keydown', escHandler);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function closeModal() {
  const overlay = document.getElementById('historyModal');
  if (overlay) {
    overlay.remove();
    window.removeEventListener('keydown', escHandler);
  }
}
function escHandler(e) {
  if (e.key === 'Escape') closeModal();
}

// -------- Парсинг и загрузка --------
async function runParse() {
  const q = document.getElementById('searchQuery').value.trim();
  if (!q) return showToast('Введите поисковый запрос');
  addToHistory(q);
  try {
    const res = await fetch(`/api/parse/?search=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (res.ok) {
      showToast(`Импортировано ${data.parsed} товаров`);
      await fetchData();
    } else {
      showToast(data.error || 'Ошибка при парсинге');
    }
  } catch {
    showToast('Ошибка сети или сервера');
  }
}

async function fetchData() {
  const params = new URLSearchParams({
    max_price: document.getElementById('priceRange').value,
    min_rating: document.getElementById('minRating').value,
    min_reviews: document.getElementById('minReviews').value
  });
  try {
    const res = await fetch(`/api/products/?${params}`);
    const data = await res.json();
    if (!Array.isArray(data)) return console.warn('Ожидался массив:', data);
    lastLoadedProducts = data;
    renderTable(data);
    renderCharts(data);
  } catch {
    showToast('Не удалось загрузить товары');
  }
}

// -------- Сортировка  --------
function setupSorting() {
  document.querySelectorAll('#productTable thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const f = th.dataset.sort;
      if (currentSortField === f) {
        currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
      } else {
        currentSortField = f; currentSortOrder = 'asc';
      }
      document.querySelectorAll('.sort-indicator').forEach(el => el.textContent = '');
      th.querySelector('.sort-indicator').textContent = currentSortOrder==='asc' ? '▲' : '▼';
      const sorted = [...lastLoadedProducts].sort((a,b) => {
        let va=a[f], vb=b[f];
        if (typeof va==='string') return currentSortOrder==='asc'?va.localeCompare(vb):vb.localeCompare(va);
        return currentSortOrder==='asc'?va-vb:vb-va;
      });
      renderTable(sorted);
    });
  });
}

// -------- Рендер таблицы и графиков --------
function renderTable(products) {
  const tbody = document.querySelector('#productTable tbody');
  tbody.innerHTML = '';
  if (products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-gray-500">Нет результатов</td></tr>`;
    return;
  }
  for (const p of products) {
    tbody.insertAdjacentHTML('beforeend', `
      <tr class="hover:bg-gray-50 transition">
        <td class="p-2">
          ${p.name}
          ${p.url ? `<a href="${p.url}" target="_blank" class="text-indigo-600 hover:underline ml-1">(Тык)</a>` : ''}
        </td>
        <td class="p-2">${p.price.toFixed(2)}₽</td>
        <td class="p-2">${p.discount_price.toFixed(2)}₽</td>
        <td class="p-2">${p.rating.toFixed(1)}</td>
        <td class="p-2">${p.reviews}</td>
      </tr>
    `);
  }
}

function renderCharts(products) {
  if (priceChart) priceChart.destroy();
  if (discountChart) discountChart.destroy();

  // Гистограмма цен
  const buckets = Array(10).fill(0), size = 5000;
  products.forEach(p => buckets[Math.min(Math.floor(p.price/size), 9)]++);
  const labels = buckets.map((_, i) => `${i*size}–${(i+1)*size}₽`);
  priceChart = new Chart(document.getElementById('priceHist'), {
    type: 'bar',
    data: { labels, datasets: [{ data: buckets, backgroundColor: '#8b5cf6', borderRadius: 6 }] },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        title: { display: true, text: 'Распределение по ценам' }
      },
      scales: {
        x: { title: { display: true, text: 'Диапазон' } },
        y: { beginAtZero: true, title: { display: true, text: 'Кол-во' } }
      }
    }
  });

  // Средняя скидка vs Рейтинг
  const groups = {};
  products.forEach(p => {
    const r = parseFloat(p.rating.toFixed(1));
    const d = Math.abs(p.price - p.discount_price);
    (groups[r] || (groups[r] = [])).push(d);
  });
  const xs = Object.keys(groups).sort((a, b) => a - b);
  const ys = xs.map(r => (groups[r].reduce((a, b) => a + b, 0) / groups[r].length).toFixed(2));
  discountChart = new Chart(document.getElementById('discountPlot'), {
    type: 'line',
    data: {
      labels: xs,
      datasets: [{
        label: 'Средняя скидка (₽)',
        data: ys,
        borderColor: '#8b5cf6',
        backgroundColor: '#db7093',
        fill: false,
        tension: 0.4,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: 'Средняя скидка vs Рейтинг' },
        tooltip: { callbacks: { label: ctx => `Скидка: ${ctx.formattedValue}₽` } }
      },
      scales: {
        x: { title: { display: true, text: 'Рейтинг' } },
        y: { beginAtZero: true, title: { display: true, text: 'Скидка (₽)' } }
      }
    }
  });
}


// -------- Тост --------
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
