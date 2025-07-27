document.addEventListener('DOMContentLoaded', () => {
  const video = document.getElementById('scrollVideo');
  const DESKTOP_BREAKPOINT = 768;
  let animationFrameId;

  const setupVideo = () => {
    // Clean up previous listeners/loops
    window.removeEventListener('scroll', scrollHandler);
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }

    if (window.innerWidth < DESKTOP_BREAKPOINT) {
      // Mobile: Direct scroll-to-play, "primed" by the first touch
      video.pause();
      const primeVideo = () => {
        video.play();
        video.pause();
        // The event listener is removed so this only ever happens once.
        document.body.removeEventListener('touchstart', primeVideo);
      };
      document.body.addEventListener('touchstart', primeVideo);
      window.addEventListener('scroll', scrollHandler);
    } else {
      // Desktop: Smoothed scroll-to-play
      let targetTime = 0;
      const LERP_FACTOR = 0.1;
      video.pause();

      window.addEventListener('scroll', () => {
        const scrollableHeight = document.body.scrollHeight - window.innerHeight;
        if (scrollableHeight <= 0) return;
        targetTime = (window.scrollY / scrollableHeight) * video.duration;
      });

      const animate = () => {
        const currentTime = video.currentTime;
        const newTime = currentTime + (targetTime - currentTime) * LERP_FACTOR;
        if (Math.abs(newTime - currentTime) > 0.01) {
          video.currentTime = newTime;
        }
        animationFrameId = requestAnimationFrame(animate);
      };
      animate();
    }
  };

  const scrollHandler = () => {
    const scrollableHeight = document.body.scrollHeight - window.innerHeight;
    if (scrollableHeight <= 0) return;
    const scroll = window.scrollY / scrollableHeight;
    if (video.duration) {
      video.currentTime = video.duration * scroll;
    }
  };

  video.addEventListener('loadedmetadata', () => {
    let targetTime = 0;
    const LERP_FACTOR = 0.1; // Controls smoothness: smaller is smoother
    video.pause();

    // A function to calculate and set the video's target time based on scroll.
    const setTargetTimeFromScroll = () => {
      const scrollableHeight = document.body.scrollHeight - window.innerHeight;
      if (scrollableHeight > 0 && video.duration) {
        targetTime = (window.scrollY / scrollableHeight) * video.duration;
      } else {
        targetTime = 0;
      }
    };

    // For mobile, "prime" the video on the first touch to enable scripting.
    const primeVideo = () => {
      if (video.paused) {
        video.play();
        video.pause();
      }
      document.body.removeEventListener('touchstart', primeVideo);
    };
    document.body.addEventListener('touchstart', primeVideo);

    // Set the initial position of the video on page load.
    setTargetTimeFromScroll();
    
    // Listen for scroll events to update the video's target time.
    window.addEventListener('scroll', setTargetTimeFromScroll);

    // Use an animation loop for smooth, interpolated playback.
    const animate = () => {
      const currentTime = video.currentTime;
      const newTime = currentTime + (targetTime - currentTime) * LERP_FACTOR;
      if (Math.abs(newTime - currentTime) > 0.01) {
        video.currentTime = newTime;
      }
      requestAnimationFrame(animate);
    };
    animate();
  });

  const zoomLink = 'https://zoom.us/j/TODO'; // Placeholder Zoom link

  // Update main "Add to Calendar" link
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
    let eventDetails = `Talk by ${speakerName} at SceneComp 2025.`;
    eventDetails += ` Join here: ${zoomLink}`;
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