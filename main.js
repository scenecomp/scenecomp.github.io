document.addEventListener('DOMContentLoaded', () => {
// === Position-mapped video with velocity-adaptive subsampling ===
(() => {
  const video = document.getElementById('scrollVideo');

  // Tunables
  const STEP_FPS     = 30;     // logical steps per second of video (target detail at slow scroll)
  const PAD_END      = 0.05;   // keep a little headroom off the very end
  const V_SMOOTH     = 0.25;   // EMA smoothing of scroll velocity (0..1, higher = smoother)
  const BASE_STRIDE  = 1;      // minimum step multiple (1 = finest)
  const GAIN_STRIDE  = 0.002;  // px/sec → extra stride growth (increase to skip more on fast scroll)
  const MAX_STRIDE   = 12;     // upper bound on stride multiple (bigger = more skipping at high speed)

  let dur = 1;
  let totalSteps = 1;
  let lastAppliedStep = -1;

  // scroll velocity state
  let lastT = null;
  let lastScrollY = window.scrollY;
  let vEma = 0; // px/sec

  // Mobile priming so seeks are reliable
  const primeVideo = () => {
    try { video.play().catch(()=>{}).finally(() => video.pause()); } catch {}
    document.body.removeEventListener('touchstart', primeVideo);
  };
  document.body.addEventListener('touchstart', primeVideo, { once: true });

  video.addEventListener('loadedmetadata', () => {
    dur = Math.max(1, video.duration || 1);
    totalSteps = Math.max(1, Math.floor(dur * STEP_FPS));
    video.pause();
    video.removeAttribute('loop');
    video.currentTime = 0;
    lastT = null;
    lastAppliedStep = -1;
  });

  // Map scroll position → target step (0..totalSteps)
  function desiredStepFromScroll() {
    const de = document.documentElement;
    const maxScroll = Math.max(1, de.scrollHeight - de.clientHeight);
    const raw = window.scrollY / maxScroll; // 0..1
    return Math.round(raw * totalSteps);
  }

  // rAF loop: measure velocity, compute stride, quantize desired step, seek
  function tick(now) {
    if (lastT == null) lastT = now;
    const dt = Math.max(0, (now - lastT) / 1000); // seconds
    lastT = now;

    // px/sec velocity (positive down)
    const y = window.scrollY;
    const vy = (y - lastScrollY) / (dt || 1e-6);
    lastScrollY = y;

    // Smooth velocity to reduce jitter
    vEma = V_SMOOTH * vy + (1 - V_SMOOTH) * vEma;

    // Compute stride multiple from |velocity|
    const stride = Math.max(
      BASE_STRIDE,
      Math.min(MAX_STRIDE, Math.floor(BASE_STRIDE + Math.abs(vEma) * GAIN_STRIDE))
    );

    // Desired step from position, then quantize to stride grid
    const want = desiredStepFromScroll();
    const quant = Math.round(want / stride) * stride;

    if (quant !== lastAppliedStep) {
      lastAppliedStep = quant;
      const hiStep = Math.max(0, totalSteps - Math.floor(PAD_END * STEP_FPS));
      const clampedStep = Math.max(0, Math.min(quant, hiStep));
      const t = (clampedStep / totalSteps) * dur;

      if (!Number.isNaN(t)) {
        // Use fastSeek when available for snappier jumps
        if (typeof video.fastSeek === 'function') {
          try { video.fastSeek(t); } catch { video.currentTime = t; }
        } else {
          video.currentTime = t;
        }
      }
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Recompute step count on resize (page height changes) and on load
  const recalc = () => {
    if (video.duration) {
      dur = Math.max(1, video.duration);
      totalSteps = Math.max(1, Math.floor(dur * STEP_FPS));
    }
  };
  window.addEventListener('resize', recalc);
  window.addEventListener('load', recalc);
})();


  // === Your existing calendar / talks code ===
  const zoomLink = 'https://scenecomp.github.io/';

  const mainCalendarLink = document.getElementById('main-calendar-link');
  if (mainCalendarLink) {
    const url = new URL(mainCalendarLink.href);
    let details = url.searchParams.get('details') || '';
    details += ` Join here: ${zoomLink}`;
    url.searchParams.set('details', details);
    mainCalendarLink.href = url.toString();
  }

  const talks = document.querySelectorAll('tbody tr');
  const eventDate = '20251020';
  const calendarIconSvg = `<svg class="w-4 h-4 text-gray-400 hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;

  talks.forEach(talk => {
    const cells = talk.children;
    if (cells.length < 2) return;

    const timeCell = cells[0];
    const speakerCell = cells[1];
    const speakerName = speakerCell.textContent.trim();
    const isSpecialSlot = ["Opening Remarks", "Coffee Break", "Closing Remarks"].includes(speakerName);

    const timeString = timeCell.textContent.trim();
    const timeMatch = timeString.match(/(\d{2}):(\d{2})\s*–\s*(\d{2}):(\d{2})/);
    if (isSpecialSlot || !timeMatch) return;

    const [, startHour, startMin, endHour, endMin] = timeMatch;
    const dates = `${eventDate}T${startHour}${startMin}00/${eventDate}T${endHour}${endMin}00`;
    const eventTitle = `SceneComp @ ICCV 2025: ${speakerName}`;
    let eventDetails = `Talk by ${speakerName} at SceneComp 2025. Join here: ${zoomLink}`;
    const location = `ICCV 2025`;
    const timezone = `Pacific/Honolulu`;

    const url = new URL('https://www.google.com/calendar/event');
    url.searchParams.set('action', 'TEMPLATE');
    url.searchParams.set('text', eventTitle);
    url.searchParams.set('dates', dates);
    url.searchParams.set('details', eventDetails);
    url.searchParams.set('location', location);
    url.searchParams.set('ctz', timezone);

    const calendarLink = document.createElement('a');
    calendarLink.href = url.href;
    calendarLink.target = '_blank';
    calendarLink.rel = 'noopener';
    calendarLink.classList.add('inline-block', 'align-middle', 'ml-2');
    calendarLink.innerHTML = calendarIconSvg;

    speakerCell.appendChild(calendarLink);
  });
});
