import './style.css';
import {
  createIcons, Orbit, Search, Route, BookOpen, Volume2, VolumeX, Maximize, Minimize,
  ChevronRight, ArrowUpRight, Bookmark, BookmarkCheck, Play, Pause, RotateCcw,
  X, Plus, Navigation, Mouse, Keyboard, Sparkles, Check, Menu, Telescope,
  Gauge, CircleHelp, Rocket, MapPin, CornerDownLeft
} from 'lucide';
import { UniverseScene } from './scene.js';
import { byId, grandTour, objects } from './data.js';

const icons = { Orbit, Search, Route, BookOpen, Volume2, VolumeX, Maximize, Minimize, ChevronRight, ArrowUpRight, Bookmark, BookmarkCheck, Play, Pause, RotateCcw, X, Plus, Navigation, Mouse, Keyboard, Sparkles, Check, Menu, Telescope, Gauge, CircleHelp, Rocket, MapPin, CornerDownLeft };
const refreshIcons = () => createIcons({ icons, attrs: { 'stroke-width': 1.65 } });
const readFavorites = () => {
  try { return JSON.parse(localStorage.getItem('orbita-favorites') || '[]'); }
  catch { return []; }
};
const state = {
  selectedId: 'earth', category: 'planets', query: '', speed: 1,
  favorites: readFavorites(), sound: false, cruise: false,
  touring: false, tourIndex: 0, tourTimer: null, modal: null
};

const app = document.querySelector('#app');
app.innerHTML = `
  <div id="universe" aria-label="Интерактивная трёхмерная вселенная"></div>
  <div class="vignette"></div>
  <div class="loading-screen" id="loading-screen">
    <div class="loading-orbit"><i data-lucide="orbit"></i></div>
    <div class="loading-name">ОРБИТА</div>
    <div class="loading-line"><span></span></div>
    <p>Загружаем карту вселенной</p>
  </div>

  <header class="topbar">
    <a class="brand" href="#" aria-label="Орбита — на главную">
      <span class="brand-mark"><i data-lucide="orbit"></i></span>
      <span>ОРБИТА<small>UNIVERSE EXPLORER</small></span>
    </a>
    <nav class="main-nav" aria-label="Основная навигация">
      <button class="nav-link active" data-action="explore"><i data-lucide="telescope"></i>Исследовать</button>
      <button class="nav-link" data-action="routes"><i data-lucide="route"></i>Маршруты<span class="nav-count" id="route-count">0</span></button>
      <button class="nav-link" data-action="guide"><i data-lucide="book-open"></i>Справочник</button>
    </nav>
    <div class="header-tools">
      <div class="session"><span class="live-dot"></span><span>СЕАНС</span><b id="session-time">00:00</b></div>
      <button class="icon-button" data-action="sound" aria-label="Включить космический звук" title="Космический звук"><i data-lucide="volume-x"></i></button>
      <button class="icon-button" data-action="fullscreen" aria-label="Полноэкранный режим" title="Полноэкранный режим"><i data-lucide="maximize"></i></button>
      <button class="icon-button mobile-menu" data-action="toggle-catalog" aria-label="Открыть каталог"><i data-lucide="menu"></i></button>
    </div>
  </header>

  <aside class="catalog panel" id="catalog">
    <div class="panel-heading">
      <div><span class="eyebrow">НАВИГАЦИЯ</span><h2>Каталог объектов</h2></div>
      <span class="object-total">${objects.length}</span>
    </div>
    <label class="search-box">
      <i data-lucide="search"></i>
      <input id="search" type="search" placeholder="Найти во вселенной…" autocomplete="off" aria-label="Поиск небесного тела" />
      <kbd>/</kbd>
    </label>
    <div class="catalog-tabs" role="tablist" aria-label="Тип объекта">
      <button class="active" data-category="planets" role="tab">Планеты</button>
      <button data-category="stars" role="tab">Звёзды</button>
      <button data-category="exoplanets" role="tab">Экзопланеты</button>
      <button data-category="galaxies" role="tab">Галактики</button>
    </div>
    <div class="object-list" id="object-list"></div>
    <button class="tour-card" data-action="tour">
      <span class="tour-art"><i data-lucide="route"></i></span>
      <span><small>ГОТОВЫЙ МАРШРУТ</small><strong>Гранд-тур</strong><em>10 миров · около 3 минут</em></span>
      <i data-lucide="chevron-right"></i>
    </button>
  </aside>

  <main class="viewport-ui">
    <div class="location-line">
      <span class="location-cross"></span>
      <span id="system-name">СОЛНЕЧНАЯ СИСТЕМА</span><b>/</b><strong id="location-name">ЗЕМЛЯ</strong>
    </div>
    <div class="scene-badge"><span></span> РЕЖИМ СВОБОДНОГО ПОЛЁТА</div>
    <div class="object-marker" id="object-marker"><span></span><b id="marker-name">ЗЕМЛЯ</b><small id="marker-distance">ТЕКУЩАЯ ЦЕЛЬ</small></div>
  </main>

  <aside class="details panel" id="details"></aside>

  <div class="view-tools">
    <button class="glass-button" data-action="overview"><i data-lucide="orbit"></i><span>Обзор системы</span></button>
    <button class="glass-button icon-only" data-action="reset" aria-label="Вернуться к объекту" title="Вернуться к объекту"><i data-lucide="rotate-ccw"></i></button>
  </div>

  <div class="flight-notice" id="flight-notice">
    <span class="flight-pulse"><i data-lucide="navigation"></i></span>
    <div><small>КУРС ПРОЛОЖЕН</small><strong id="flight-destination">Земля</strong></div>
    <div class="flight-progress"><span></span></div>
  </div>

  <section class="flight-console panel" aria-label="Управление полётом">
    <button class="cruise-button" data-action="cruise" aria-label="Включить автопилот"><i data-lucide="play"></i></button>
    <div class="speed-control">
      <div class="speed-heading"><span><i data-lucide="gauge"></i>СКОРОСТЬ ПОЛЁТА</span><strong id="speed-value">1×</strong></div>
      <input type="range" min="0" max="100" value="40" id="speed-slider" aria-label="Скорость перемещения" />
      <div class="speed-presets">
        <button data-speed="0.5">0,5×<small>ОБЗОР</small></button>
        <button class="active" data-speed="1">1×<small>КРЕЙСЕР</small></button>
        <button data-speed="10">10×<small>ГИПЕР</small></button>
      </div>
    </div>
    <div class="control-hint"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><small>ДВИЖЕНИЕ</small><b>Мышь — обзор</b></div>
  </section>

  <footer class="statusbar">
    <div><span class="status-dot"></span><span id="flight-status">НА ОРБИТЕ</span><b>·</b><span id="engine-status">ДВИГАТЕЛЬ ГОТОВ</span></div>
    <button data-action="guide"><i data-lucide="circle-help"></i>Управление</button>
  </footer>

  <div class="modal-backdrop" id="modal" hidden>
    <section class="modal panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button class="modal-close icon-button" data-action="close-modal" aria-label="Закрыть"><i data-lucide="x"></i></button>
      <div id="modal-content"></div>
    </section>
  </div>
  <div class="toast" id="toast"><i data-lucide="check"></i><span></span></div>
`;

function thumbStyle(object) {
  if (object.type === 'galaxies') return `--object-color:${object.color}`;
  if (object.procedural) return `--object-color:${object.color};background-image:radial-gradient(circle at 32% 28%, ${object.surface[0]}, ${object.surface[1]} 68%, #090c12)`;
  if (!object.texture) return `--object-color:${object.color};background-image:radial-gradient(circle at 38% 34%, #ffffff, ${object.color} 42%, #090c12 80%)`;
  return `--object-color:${object.color};background-image:url('/textures/${object.texture}.jpg')`;
}

function renderCatalog() {
  const filtered = objects.filter((object) => object.type === state.category && object.name.toLowerCase().includes(state.query.toLowerCase().trim()));
  const list = document.querySelector('#object-list');
  list.innerHTML = filtered.length ? filtered.map((object) => `
    <button class="object-card ${object.id === state.selectedId ? 'selected' : ''}" data-object="${object.id}">
      <span class="object-thumb ${object.type}" style="${thumbStyle(object)}">${object.type === 'galaxies' ? '<span></span>' : ''}</span>
      <span class="object-card-copy"><strong>${object.name}</strong><small>${object.type === 'planets' ? object.kind.toLowerCase() : object.distance}</small></span>
      ${object.id === state.selectedId ? '<span class="selected-indicator"></span>' : '<i data-lucide="chevron-right"></i>'}
    </button>
  `).join('') : `<div class="empty-search"><i data-lucide="search"></i><strong>Ничего не найдено</strong><span>Попробуйте другое название</span></div>`;
  document.querySelectorAll('[data-category]').forEach((button) => {
    button.classList.toggle('active', button.dataset.category === state.category);
    button.setAttribute('aria-selected', button.dataset.category === state.category);
  });
  refreshIcons();
}

function renderDetails() {
  const object = byId[state.selectedId];
  const favorite = state.favorites.includes(object.id);
  document.querySelector('#details').innerHTML = `
    <div class="details-topline"><span class="eyebrow">${object.kind}</span><button class="bookmark-button ${favorite ? 'saved' : ''}" data-action="favorite" aria-label="${favorite ? 'Удалить из маршрутов' : 'Добавить в маршруты'}"><i data-lucide="${favorite ? 'bookmark-check' : 'bookmark'}"></i></button></div>
    <h1>${object.name}</h1>
    <div class="object-subtitle"><span style="background:${object.color}"></span>${object.system}</div>
    <p class="object-description">${object.description}</p>
    <div class="object-stats">${object.stats.map(([label, value]) => `<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div>
    <button class="primary-button" data-action="travel"><i data-lucide="navigation"></i>Лететь к объекту<i data-lucide="arrow-up-right"></i></button>
    <div class="distance-line"><i data-lucide="map-pin"></i><span>${object.distance}</span></div>
    <div class="fact-card"><span><i data-lucide="sparkles"></i>ЗНАЕТЕ ЛИ ВЫ?</span><p>${object.fact}</p></div>
  `;
  document.querySelector('#system-name').textContent = object.system;
  document.querySelector('#location-name').textContent = object.name.toUpperCase();
  document.querySelector('#marker-name').textContent = object.name.toUpperCase();
  document.querySelector('#route-count').textContent = state.favorites.length;
  refreshIcons();
}

function selectObject(id, travel = true) {
  if (!byId[id]) return;
  state.selectedId = id;
  renderCatalog();
  renderDetails();
  if (window.innerWidth < 900) document.querySelector('#catalog').classList.remove('open');
  if (travel) scene.travelTo(id);
}

function updateSpeed(value, sliderValue) {
  state.speed = value;
  scene.setSpeed(value);
  document.querySelector('#speed-value').textContent = `${value < 1 ? value.toFixed(1).replace('.', ',') : Number.isInteger(value) ? value : value.toFixed(1)}×`;
  document.querySelector('#speed-slider').value = sliderValue ?? Math.round(Math.log10(value * 10) / 3 * 100);
  document.querySelector('#speed-slider').style.setProperty('--range-progress', `${document.querySelector('#speed-slider').value}%`);
  document.querySelectorAll('[data-speed]').forEach((button) => button.classList.toggle('active', Number(button.dataset.speed) === value));
}

function toggleCruise() {
  state.cruise = !state.cruise;
  scene.setCruise(state.cruise);
  const button = document.querySelector('[data-action="cruise"]');
  button.classList.toggle('active', state.cruise);
  button.innerHTML = `<i data-lucide="${state.cruise ? 'pause' : 'play'}"></i>`;
  button.setAttribute('aria-label', state.cruise ? 'Выключить автопилот' : 'Включить автопилот');
  document.querySelector('#engine-status').textContent = state.cruise ? 'АВТОПИЛОТ ВКЛЮЧЁН' : 'ДВИГАТЕЛЬ ГОТОВ';
  refreshIcons();
}

function toggleFavorite() {
  const id = state.selectedId;
  if (state.favorites.includes(id)) {
    state.favorites = state.favorites.filter((item) => item !== id);
    showToast(`${byId[id].name} удалён из маршрутов`);
  } else {
    state.favorites.push(id);
    showToast(`${byId[id].name} добавлен в маршруты`);
  }
  localStorage.setItem('orbita-favorites', JSON.stringify(state.favorites));
  renderDetails();
}

function openModal(type) {
  state.modal = type;
  const modal = document.querySelector('#modal');
  const content = document.querySelector('#modal-content');
  modal.hidden = false;
  if (type === 'routes') {
    content.innerHTML = `
      <span class="eyebrow">ВАШ КОСМИЧЕСКИЙ ЖУРНАЛ</span>
      <h2 id="modal-title">Маршруты</h2>
      <p class="modal-intro">Сохраняйте интересные миры и возвращайтесь к ним в один клик.</p>
      <div class="featured-route">
        <div class="route-visual"><i data-lucide="route"></i><span>01 — 10</span></div>
        <div><small>РЕКОМЕНДУЕМЫЙ МАРШРУТ</small><h3>Гранд-тур по вселенной</h3><p>Земля → Луна → Марс → Юпитер → Сатурн → Нептун → Сириус → Проксима b → Андромеда → Солнце</p></div>
        <button class="primary-button" data-action="tour"><i data-lucide="play"></i>Запустить маршрут</button>
      </div>
      <div class="saved-heading"><h3>Сохранённые объекты</h3><span>${state.favorites.length}</span></div>
      <div class="saved-routes">
        ${state.favorites.length ? state.favorites.map((id) => {
          const object = byId[id];
          return `<div class="saved-route"><span class="object-thumb ${object.type}" style="${thumbStyle(object)}"></span><button data-route-object="${id}"><strong>${object.name}</strong><small>${object.kind}</small></button><button class="icon-button" data-remove-route="${id}" aria-label="Удалить ${object.name}"><i data-lucide="x"></i></button></div>`;
        }).join('') : '<div class="empty-routes"><i data-lucide="bookmark"></i><strong>Здесь пока просторно</strong><p>Нажмите на закладку рядом с названием объекта, чтобы добавить его в свой журнал.</p></div>'}
      </div>
    `;
  } else {
    content.innerHTML = `
      <span class="eyebrow">ПОЛЁТНЫЙ СПРАВОЧНИК</span>
      <h2 id="modal-title">Как исследовать вселенную</h2>
      <p class="modal-intro">Выберите цель в каталоге или проложите собственный курс. Всё пространство открыто для движения.</p>
      <div class="guide-grid">
        <div class="guide-card"><i data-lucide="mouse"></i><h3>Обзор и дистанция</h3><p>Зажмите левую кнопку мыши и двигайте курсор, чтобы осмотреться. Колесо приближает и удаляет камеру.</p></div>
        <div class="guide-card"><i data-lucide="keyboard"></i><h3>Свободный полёт</h3><p><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> — движение, <kbd>Q</kbd> / <kbd>E</kbd> — вниз и вверх. <kbd>Shift</kbd> — ускорение.</p></div>
        <div class="guide-card"><i data-lucide="gauge"></i><h3>Скорость</h3><p>Перемещайте ползунок или выберите пресет. Скорость влияет на полёт, перелёт между мирами и вращение планет.</p></div>
        <div class="guide-card"><i data-lucide="navigation"></i><h3>Автопилот</h3><p>Нажмите <kbd>Space</kbd> или кнопку воспроизведения, чтобы двигаться вперёд без клавиш. Клик по планете проложит курс.</p></div>
      </div>
      <div class="scale-note"><i data-lucide="sparkles"></i><p><strong>Создано для исследования</strong>Орбитальные расстояния и соотношения периодов в Солнечной системе соответствуют реальным, но время ускорено. Размеры тел увеличены для наглядности. Звёзды и поверхности экзопланет создаются процедурно; их внешний вид является художественной реконструкцией. Текстуры планет: NASA / JPL, Solar System Scope.</p></div>
    `;
  }
  refreshIcons();
  modal.querySelector('.modal-close').focus();
}

function closeModal() {
  document.querySelector('#modal').hidden = true;
  state.modal = null;
}

function startTour() {
  closeModal();
  clearTimeout(state.tourTimer);
  state.touring = true;
  state.tourIndex = 0;
  showToast('Гранд-тур начался. Следующая остановка — Земля');
  selectObject(grandTour[0]);
}

function continueTour(completedId) {
  if (!state.touring || completedId !== grandTour[state.tourIndex]) return;
  if (state.tourIndex >= grandTour.length - 1) {
    state.touring = false;
    showToast('Гранд-тур завершён. Вселенная ждёт новых открытий');
    return;
  }
  state.tourTimer = setTimeout(() => {
    state.tourIndex += 1;
    if (state.tourIndex === grandTour.length - 1) {
      selectObject(grandTour[state.tourIndex], false);
      scene.travelToSolarView();
    } else {
      selectObject(grandTour[state.tourIndex]);
    }
  }, Math.max(1800, 3600 / Math.sqrt(state.speed)));
}

function showToast(message) {
  const toast = document.querySelector('#toast');
  toast.querySelector('span').textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

const SOUND_BASE_GAIN = 0.5;
let audioContext;
let audioElement;
let audioGain;
let soundFactor = 1;
let lastAppliedGain = 0;
async function toggleSound() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioElement = new Audio('/textures/noise.mp3');
    audioElement.loop = true;
    audioGain = audioContext.createGain();
    audioGain.gain.value = 0;
    audioContext.createMediaElementSource(audioElement).connect(audioGain).connect(audioContext.destination);
  }
  await audioContext.resume();
  state.sound = !state.sound;
  if (state.sound) await audioElement.play().catch(() => {});
  else audioElement.pause();
  lastAppliedGain = state.sound ? SOUND_BASE_GAIN * soundFactor : 0;
  audioGain.gain.setTargetAtTime(lastAppliedGain, audioContext.currentTime, 0.5);
  const button = document.querySelector('[data-action="sound"]');
  button.innerHTML = `<i data-lucide="${state.sound ? 'volume-2' : 'volume-x'}"></i>`;
  button.classList.toggle('active', state.sound);
  button.setAttribute('aria-label', state.sound ? 'Выключить космический звук' : 'Включить космический звук');
  refreshIcons();
  showToast(state.sound ? 'Космический звук включён' : 'Космический звук выключен');
}

const scene = new UniverseScene(document.querySelector('#universe'), {
  onReady: () => {
    document.querySelector('#loading-screen').classList.add('loaded');
    setTimeout(() => document.querySelector('#loading-screen')?.remove(), 800);
  },
  onObjectClick: (id) => selectObject(id),
  onFocusChange: (id) => { state.category = byId[id].type; selectObject(id, false); },
  onProximity: (factor) => {
    soundFactor = factor;
    if (!audioContext || !state.sound) return;
    const target = SOUND_BASE_GAIN * factor;
    if (Math.abs(target - lastAppliedGain) < 0.0005) return;
    lastAppliedGain = target;
    audioGain.gain.setTargetAtTime(target, audioContext.currentTime, 0.3);
  },
  onLevelChange: (level) => showToast(level === 'stellar' ? 'Масштаб: звёзды. Вы внутри Млечного Пути' : 'Масштаб: галактики'),
  onTravelStart: (id, duration) => {
    document.querySelector('#flight-status').textContent = 'В ПУТИ';
    const notice = document.querySelector('#flight-notice');
    notice.classList.add('visible');
    document.querySelector('#flight-destination').textContent = id === 'overview' ? 'Обзор Солнечной системы' : byId[id].name;
    notice.querySelector('.flight-progress span').style.animationDuration = `${duration}s`;
    document.querySelector('#object-marker').classList.add('hidden');
  },
  onTravelEnd: (id) => {
    document.querySelector('#flight-status').textContent = id === 'overview' ? 'ОБЗОР СИСТЕМЫ' : 'НА ОРБИТЕ';
    document.querySelector('#flight-notice').classList.remove('visible');
    document.querySelector('#object-marker').classList.remove('hidden');
    if (id !== 'overview') continueTour(id);
  }
});

renderCatalog();
renderDetails();
updateSpeed(1, 40);
refreshIcons();

app.addEventListener('click', (event) => {
  const objectButton = event.target.closest('[data-object]');
  const categoryButton = event.target.closest('[data-category]');
  const speedButton = event.target.closest('[data-speed]');
  const actionButton = event.target.closest('[data-action]');
  const routeObject = event.target.closest('[data-route-object]');
  const removeRoute = event.target.closest('[data-remove-route]');
  if (objectButton) selectObject(objectButton.dataset.object);
  if (categoryButton) {
    state.category = categoryButton.dataset.category;
    state.query = '';
    document.querySelector('#search').value = '';
    renderCatalog();
  }
  if (speedButton) { updateSpeed(Number(speedButton.dataset.speed)); speedButton.blur(); }
  if (routeObject) { closeModal(); selectObject(routeObject.dataset.routeObject); }
  if (removeRoute) {
    state.favorites = state.favorites.filter((id) => id !== removeRoute.dataset.removeRoute);
    localStorage.setItem('orbita-favorites', JSON.stringify(state.favorites));
    document.querySelector('#route-count').textContent = state.favorites.length;
    renderDetails();
    openModal('routes');
  }
  if (!actionButton) return;
  const actions = {
    explore: () => { closeModal(); document.querySelector('#catalog').classList.remove('open'); },
    routes: () => openModal('routes'), guide: () => openModal('guide'),
    'close-modal': closeModal, travel: () => scene.travelTo(state.selectedId),
    favorite: toggleFavorite, cruise: toggleCruise, tour: startTour,
    overview: () => scene.showOverview(), reset: () => scene.travelTo(state.selectedId),
    sound: toggleSound,
    fullscreen: async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch { showToast('Полноэкранный режим недоступен в этом окне'); }
    },
    'toggle-catalog': () => document.querySelector('#catalog').classList.toggle('open')
  };
  actions[actionButton.dataset.action]?.();
});

document.querySelector('#search').addEventListener('input', (event) => {
  state.query = event.target.value;
  renderCatalog();
});

document.querySelector('#speed-slider').addEventListener('input', (event) => {
  const sliderValue = Number(event.target.value);
  updateSpeed(Number((0.1 * Math.pow(1000, sliderValue / 100)).toFixed(1)), sliderValue);
});

document.querySelector('#speed-slider').addEventListener('change', (event) => event.target.blur());

document.querySelector('#modal').addEventListener('click', (event) => {
  if (event.target.id === 'modal') closeModal();
});

document.querySelector('.brand').addEventListener('click', (event) => {
  event.preventDefault();
  closeModal();
  selectObject('earth');
});

window.addEventListener('keydown', (event) => {
  if (event.code === 'Escape') { closeModal(); document.querySelector('#catalog').classList.remove('open'); }
  if (event.code === 'Slash' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    event.preventDefault();
    document.querySelector('#search').focus();
  }
  if (event.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement.tagName) && !state.modal) toggleCruise();
});

document.addEventListener('fullscreenchange', () => {
  const button = document.querySelector('[data-action="fullscreen"]');
  button.innerHTML = `<i data-lucide="${document.fullscreenElement ? 'minimize' : 'maximize'}"></i>`;
  refreshIcons();
});

const sessionStarted = Date.now();
setInterval(() => {
  const seconds = Math.floor((Date.now() - sessionStarted) / 1000);
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  document.querySelector('#session-time').textContent = `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
}, 1000);
