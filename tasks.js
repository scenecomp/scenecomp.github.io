document.addEventListener('DOMContentLoaded', () => {
  // Tabbed interface for the Tasks explainer
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  const highlightRegion = document.getElementById('plot-highlight-region');
  const highlightClasses = ['multi-image-region', 'single-image-region', 'text-prompt-region'];

  if (tabButtons[0]) {
    tabButtons[0].classList.add('bg-blue-500', 'text-white');
    tabContents[0]?.classList.remove('hidden');
    highlightRegion?.classList.add(tabButtons[0].dataset.highlightClass);
  }

  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetContent = document.querySelector(button.dataset.tabTarget);
      const targetHighlight = button.dataset.highlightClass;

      tabContents.forEach(content => content.classList.add('hidden'));
      tabButtons.forEach(btn => btn.classList.remove('bg-blue-500', 'text-white'));

      highlightRegion?.classList.remove(...highlightClasses);
      targetContent.classList.remove('hidden');
      button.classList.add('bg-blue-500', 'text-white');
      highlightRegion?.classList.add(targetHighlight);
    });
  });

  // Paper hover effect to show highlight on the plot
  const paperItems = document.querySelectorAll('.paper-item');
  paperItems.forEach(item => {
    const targetId = item.dataset.highlightTarget;
    const highlight = document.querySelector(targetId);

    if (highlight) {
      item.addEventListener('mouseenter', () => {
        highlight.style.opacity = '1';
      });
      item.addEventListener('mouseleave', () => {
        highlight.style.opacity = '0';
      });
    }
  });

  // Submission Modal Logic for drawing and generating snippet
  const submissionModal = document.getElementById('submissionModal');
  const closeSubmissionModalBtn = document.getElementById('closeSubmissionModal');
  const plotContainer = document.getElementById('shared-plot');
  const userDrawRegion = document.getElementById('user-draw-region');

  const paperIdInput = document.getElementById('paperId');
  const paperTitleInput = document.getElementById('paperTitle');
  const paperUrlInput = document.getElementById('paperUrl');
  const generatedCodeTextarea = document.getElementById('generatedCode');
  const copyCodeBtn = document.getElementById('copyCodeBtn');

  let activeTaskInfo = null;
  let isDrawing = false;
  let startX, startY;
  let drawState = { bottom: '0', left: '0', width: '0', height: '0' };

  const updateCodeSnippet = () => {
    const id = paperIdInput.value.trim() || '[UNIQUE_ID]';
    const title = paperTitleInput.value.trim() || '[PAPER_TITLE]';
    const url = paperUrlInput.value.trim() || '[URL]';
    const taskTitle = activeTaskInfo?.title || '[TASK_TITLE]';

    const snippet = `
/*
  STEP 1: Paste this CSS inside the <style> tag in tasks.html.
*/
.${id}-style {
  bottom: ${drawState.bottom}%;
  left: ${drawState.left}%;
  width: ${drawState.width}%;
  height: ${drawState.height}%;
}

/*
  STEP 2: Paste this HTML into the paper list for the "${taskTitle}" task.
*/
<li class="paper-item" data-highlight-target="#${id}"><a href="${url}" target="_blank" title="${title}">${title}</a></li>

/*
  STEP 3: Paste this HTML inside the "shared-plot" div.
*/
<div id="${id}" class="paper-highlight ${id}-style"></div>
`;
    generatedCodeTextarea.value = snippet.trim();
  };

  const openSubmissionModal = (button) => {
    const tabContent = button.closest('.tab-content');
    activeTaskInfo = {
      id: tabContent.id,
      title: tabContent.querySelector('h3').textContent
    };

    submissionModal.querySelector('h3').textContent = `Generate Snippet for: ${activeTaskInfo.title}`;
    submissionModal.style.display = 'flex';
    plotContainer.style.cursor = 'crosshair';
    document.addEventListener('mousedown', startDrawing);
    updateCodeSnippet();
  };

  const closeSubmissionModal = () => {
    submissionModal.style.display = 'none';
    plotContainer.style.cursor = 'default';
    activeTaskInfo = null;
    document.removeEventListener('mousedown', startDrawing);
    document.removeEventListener('mousemove', drawRectangle);
    document.removeEventListener('mouseup', stopDrawing);
    userDrawRegion.style.display = 'none';
  };

  const startDrawing = (e) => {
    if (e.target.closest('#shared-plot')) {
      e.preventDefault();
      isDrawing = true;
      userDrawRegion.style.display = 'block';
      const rect = plotContainer.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      userDrawRegion.style.left = `${startX}px`;
      userDrawRegion.style.top = `${startY}px`;
      userDrawRegion.style.width = '0px';
      userDrawRegion.style.height = '0px';
      document.addEventListener('mousemove', drawRectangle);
      document.addEventListener('mouseup', stopDrawing, { once: true });
    }
  };

  const drawRectangle = (e) => {
    if (!isDrawing) return;
    const rect = plotContainer.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    const width = currentX - startX;
    const height = currentY - startY;
    userDrawRegion.style.width = `${Math.abs(width)}px`;
    userDrawRegion.style.height = `${Math.abs(height)}px`;
    userDrawRegion.style.left = `${width > 0 ? startX : currentX}px`;
    userDrawRegion.style.top = `${height > 0 ? startY : currentY}px`;
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    isDrawing = false;
    const plotWidth = plotContainer.offsetWidth;
    const plotHeight = plotContainer.offsetHeight;

    const finalLeft = parseInt(userDrawRegion.style.left);
    const finalTop = parseInt(userDrawRegion.style.top);
    const finalWidth = parseInt(userDrawRegion.style.width);
    const finalHeight = parseInt(userDrawRegion.style.height);

    drawState = {
      left: (finalLeft / plotWidth * 100).toFixed(2),
      bottom: ((plotHeight - finalTop - finalHeight) / plotHeight * 100).toFixed(2),
      width: (finalWidth / plotWidth * 100).toFixed(2),
      height: (finalHeight / plotHeight * 100).toFixed(2),
    };
    updateCodeSnippet();
  };

  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('submit-paper-btn')) {
      openSubmissionModal(e.target);
    }
  });

  [paperIdInput, paperTitleInput, paperUrlInput].forEach(input => {
    input.addEventListener('input', updateCodeSnippet);
  });

  copyCodeBtn.addEventListener('click', () => {
    generatedCodeTextarea.select();
    document.execCommand('copy');
    copyCodeBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyCodeBtn.textContent = 'Copy to Clipboard';
    }, 2000);
  });

  closeSubmissionModalBtn.addEventListener('click', closeSubmissionModal);
  submissionModal.addEventListener('click', (e) => {
    if (e.target === submissionModal) {
      closeSubmissionModal();
    }
  });
});


