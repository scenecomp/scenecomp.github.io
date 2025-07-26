const video = document.getElementById('scrollVideo');
window.addEventListener('scroll', () => {
  const scroll = window.scrollY / (document.body.scrollHeight - window.innerHeight);
  if (video.duration) {
    video.currentTime = video.duration * scroll;
  }
}); 