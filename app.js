// 1. Service Worker qeydiyyatı
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW Registered', reg))
      .catch(err => console.error('SW Error', err));
  });
}

// 2. State & Elementlər
let queue = [];
let currentIndex = -1;
let isPlaying = false;
let favorites = JSON.parse(localStorage.getItem('waveify_favorites') || '[]');

const audio = document.getElementById('audio-player');
const miniPlayer = document.getElementById('mini-player');
const nowPlayingModal = document.getElementById('now-playing-modal');
const progressBar = document.getElementById('progress-bar');
const currentTimeLabel = document.getElementById('current-time');
const totalDurationLabel = document.getElementById('total-duration');

// İlkin Mahnılar
const initialTrending = [
  {
    id: "101",
    title: "Midnight City",
    artist: "M83",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 372
  },
  {
    id: "102",
    title: "Starboy",
    artist: "The Weeknd",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    duration: 423
  },
  {
    id: "103",
    title: "Nightcall",
    artist: "Kavinsky",
    cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300",
    streamUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    duration: 345
  }
];

// Başlanğıc
document.addEventListener('DOMContentLoaded', () => {
  renderHome(initialTrending);
  updateFavCount();
  setupAudioListeners();
  setupSearch();
});

// Səhifə keçidləri
function switchTab(tabId) {
  document.querySelectorAll('.tab-page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(btn => btn.classList.remove('active'));

  const activePage = document.getElementById(`page-${tabId}`);
  if (activePage) activePage.classList.add('active');

  const tabIndex = ['home', 'search', 'library', 'profile'].indexOf(tabId);
  if (tabIndex >= 0) {
    document.querySelectorAll('.tab-bar .tab-item')[tabIndex].classList.add('active');
  }

  if (tabId === 'library') renderLibrary();
}

function createTrackElement(track, list) {
  const div = document.createElement('div');
  div.className = 'track-item';
  div.innerHTML = `
    <img class="track-cover" src="${track.cover || ''}" alt="">
    <div class="track-info">
      <div class="track-name">${escapeHtml(track.title)}</div>
      <div class="track-artist">${escapeHtml(track.artist)}</div>
    </div>
    <div class="track-duration">${formatTime(track.duration || 180)}</div>
  `;
  div.onclick = () => {
    queue = list;
    currentIndex = queue.findIndex(t => t.id === track.id);
    playTrack(track);
  };
  return div;
}

function renderHome(tracks) {
  const container = document.getElementById('home-track-list');
  container.innerHTML = '';
  tracks.forEach(track => container.appendChild(createTrackElement(track, tracks)));
}

// Canlı Axtarış Sistemi (iTunes API əsaslı)
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  let debounceTimer;

  searchInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const query = e.target.value.trim();
    if (!query) {
      document.getElementById('search-results').innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top: 40px;">Axtarmaq istədiyiniz mahnını daxil edin</p>';
      return;
    }
    debounceTimer = setTimeout(() => performSearch(query), 400);
  });
}

async function performSearch(query) {
  const resultsContainer = document.getElementById('search-results');
  resultsContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top: 40px;">Musiqi axtarılır...</p>';

  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      resultsContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top: 40px;">Heç bir mahnı tapılmadı.</p>';
      return;
    }

    const tracks = data.results.map(item => ({
      id: String(item.trackId),
      title: item.trackName,
      artist: item.artistName,
      cover: item.artworkUrl100?.replace('100x100', '300x300') || item.artworkUrl100,
      streamUrl: item.previewUrl,
      duration: Math.round(item.trackTimeMillis / 1000)
    }));

    resultsContainer.innerHTML = '';
    tracks.forEach(track => resultsContainer.appendChild(createTrackElement(track, tracks)));
  } catch (err) {
    resultsContainer.innerHTML = '<p style="text-align:center; color: #ef4444; margin-top: 40px;">Xəta baş verdi.</p>';
  }
}

// Oxutma
function playTrack(track) {
  if (!track || !track.streamUrl) return;

  audio.src = track.streamUrl;
  audio.play().then(() => {
    isPlaying = true;
    updateUI();
  }).catch(e => console.warn(e));

  updateNowPlayingInfo(track);
}

function togglePlayPause() {
  if (!audio.src) {
    if (queue.length > 0) {
      currentIndex = 0;
      playTrack(queue[0]);
    }
    return;
  }

  if (audio.paused) {
    audio.play();
    isPlaying = true;
  } else {
    audio.pause();
    isPlaying = false;
  }
  updateUI();
}

function playNext() {
  if (queue.length === 0) return;
  currentIndex = (currentIndex + 1) % queue.length;
  playTrack(queue[currentIndex]);
}

function playPrev() {
  if (queue.length === 0) return;
  currentIndex = (currentIndex - 1 + queue.length) % queue.length;
  playTrack(queue[currentIndex]);
}

function updateUI() {
  const current = queue[currentIndex];
  if (!current) return;

  miniPlayer.classList.remove('hidden');
  document.getElementById('mini-title').textContent = current.title;
  document.getElementById('mini-artist').textContent = current.artist;
  document.getElementById('mini-cover').src = current.cover;

  document.getElementById('modal-title').textContent = current.title;
  document.getElementById('modal-artist').textContent = current.artist;
  document.getElementById('modal-cover').src = current.cover;

  const playIcon = isPlaying ? '⏸' : '▶';
  document.getElementById('mini-play-icon').textContent = playIcon;
  document.getElementById('modal-play-icon').textContent = playIcon;

  const isFav = favorites.some(f => f.id === current.id);
  document.getElementById('fav-btn').textContent = isFav ? '❤️' : '🤍';
}

function setupAudioListeners() {
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      progressBar.value = (audio.currentTime / audio.duration) * 100;
      currentTimeLabel.textContent = formatTime(audio.currentTime);
      totalDurationLabel.textContent = formatTime(audio.duration);
    }
  });

  audio.addEventListener('ended', () => playNext());

  progressBar.addEventListener('input', (e) => {
    if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
  });
}

// iPhone Kilid Ekranı və Bildiriş İdarəetməsi (MediaSession API)
function updateNowPlayingInfo(track) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: [{ src: track.cover, sizes: '300x300', type: 'image/jpeg' }]
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('pause', () => togglePlayPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  }
}

function openNowPlaying() { nowPlayingModal.classList.add('open'); }
function closeNowPlaying() { nowPlayingModal.classList.remove('open'); }

function toggleFavoriteCurrent() {
  const current = queue[currentIndex];
  if (!current) return;

  const idx = favorites.findIndex(f => f.id === current.id);
  if (idx >= 0) favorites.splice(idx, 1);
  else favorites.push(current);

  localStorage.setItem('waveify_favorites', JSON.stringify(favorites));
  updateFavCount();
  updateUI();
}

function updateFavCount() {
  document.getElementById('fav-count').textContent = `${favorites.length} songs`;
}

function showFavorites() {
  if (favorites.length > 0) {
    queue = favorites;
    currentIndex = 0;
    playTrack(favorites[0]);
  }
}

function renderLibrary() {
  const container = document.getElementById('library-track-list');
  container.innerHTML = '';
  favorites.forEach(track => container.appendChild(createTrackElement(track, favorites)));
}

function filterGenre(genre) {
  document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  performSearch(genre + ' hits');
}

function formatTime(secs) {
  const m = Math.floor(secs / 60) || 0;
  const s = Math.floor(secs % 60) || 0;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
