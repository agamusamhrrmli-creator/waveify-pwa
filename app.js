if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// Mahnını yükləyib offline yaddaşda (IndexedDB / Cache) saxlamaq məntiqi
document.getElementById('downloadBtn').addEventListener('click', async () => {
  const songUrl = 'mahniniz.mp3'; // Buraya mahnı linkini əlavə edin
  const cache = await caches.open('waveify-songs');
  await cache.add(songUrl);
  alert('Mahnı offline istifadə üçün yükləndi!');
});
