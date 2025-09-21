document.addEventListener('DOMContentLoaded', () => {
  // Optional: ingest papers from a CSV-like txt file
  // Format per line: name,xminViews,xmaxViews,yminPercent,ymaxPercent,link
  // Place file at /papers.txt at project root
  const papersListEl = document.getElementById('papersList');
  const ingestPapersFromTxt = async () => {
    try {
      let text = null;
      try {
        const res = await fetch('papers.txt', { cache: 'no-store' });
        if (res.ok) {
          text = await res.text();
        }
      } catch (e) {
        // ignore network/CORS failure and try inline fallback
      }
      if (!text) {
        const inline = document.getElementById('papersTxt');
        if (inline) text = inline.textContent.trim();
      }
      if (!text) return; // nothing to ingest
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const plotContainer = document.getElementById('shared-plot');
      const fragMarkers = document.createDocumentFragment();
      const fragList = document.createDocumentFragment();
      // Remove any statically-defined markers/list items to source exclusively from file
      document.querySelectorAll('.paper-marker').forEach(el => el.remove());
      if (papersListEl) papersListEl.innerHTML = '';

      const classifyTask = (xm, ym) => {
        if (isNaN(xm) || isNaN(ym)) return '';
        if (xm <= 27) return 'text-to-3d';
        if (xm <= 50) return 'sparse-view';
        if (ym <= 50) return 'nvs';
        return 'completion';
      };

      const taskPretty = {
        'text-to-3d': 'Text-to-3D',
        'sparse-view': 'Sparse View',
        'nvs': 'Novel View',
        'completion': 'Scene Completion'
      };

      lines.forEach((line) => {
        const [nameRaw, xminViewsStr, xmaxViewsStr, yminStr, ymaxStr, link] = line.split(',').map(s => (s || '').trim());
        if (!nameRaw || !xminViewsStr || !xmaxViewsStr || !yminStr || !ymaxStr) return;
        const name = nameRaw;
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Parse numbers
        const xminViews = parseFloat(xminViewsStr);
        const xmaxViews = parseFloat(xmaxViewsStr);
        const ymin = parseFloat(yminStr);
        const ymax = parseFloat(ymaxStr);
        if ([xminViews, xmaxViews, ymin, ymax].some(v => Number.isNaN(v))) return;

        // Compute mean in axis percent space for classification
        const xmnViews = (xminViews + xmaxViews) / 2;
        const xmnPct = viewsToPercent(xmnViews);
        const ymn = (ymin + ymax) / 2;
        const task = classifyTask(xmnPct, ymn);

        // Create marker
        const marker = document.createElement('div');
        marker.className = `paper-marker ${id}-marker`;
        marker.dataset.paper = id;
        marker.dataset.tasks = task;
        marker.dataset.xminViews = String(xminViews);
        marker.dataset.xmaxViews = String(xmaxViews);
        marker.dataset.ymin = String(ymin);
        marker.dataset.ymax = String(ymax);
        const tip = document.createElement('div');
        tip.className = 'tooltip';
        tip.textContent = name;
        marker.appendChild(tip);
        fragMarkers.appendChild(marker);

        // Create list item
        const item = document.createElement('div');
        item.className = 'paper-list-item';
        item.dataset.paper = id;
        const getTagStyle = (task) => {
          const styles = {
            'text-to-3d': 'background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%); color: #be123c;',
            'sparse-view': 'background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%); color: #7e22ce;',
            'nvs': 'background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); color: #1e3a8a;',
            'completion': 'background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); color: #059669;'
          };
          return styles[task] || '';
        };
        const tagHtml = task ? `<span class="tag" style="${getTagStyle(task)}">${taskPretty[task]}</span>` : '';
        const linkHtml = link ? `<a href="${link}" target="_blank" rel="noopener">arXiv</a>` : '';
        item.innerHTML = `<h4 class="font-semibold text-gray-900">${name}</h4>
          <p class="text-sm text-blue-600 mt-1 mb-3">${linkHtml}</p>
          <div class="flex flex-wrap gap-2">${tagHtml}</div>`;
        fragList.appendChild(item);
      });
      if (plotContainer) plotContainer.appendChild(fragMarkers);
      if (papersListEl) papersListEl.prepend(fragList);

      // Re-bind interactions for new elements
      rebindInteractions();
      renderAllGaussianMarkers();
    } catch (e) {
      // ignore
    }
  };

  const rebindInteractions = () => {
    // refresh NodeLists and bindings for newly added markers/list items
    const newPaperListItems = document.querySelectorAll('.paper-list-item');
    const newPaperMarkers = document.querySelectorAll('.paper-marker');
    // Unbind by cloning? For simplicity, add only for ones without listener flags
    newPaperListItems.forEach(item => {
      if (item.__bound) return;
      item.__bound = true;
      item.addEventListener('click', () => {
        const paperId = item.dataset.paper;
        document.querySelectorAll('.paper-list-item').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.paper-marker').forEach(m => m.classList.remove('active'));
        item.classList.add('active');
        const marker = document.querySelector(`.paper-marker[data-paper="${paperId}"]`);
        if (marker) marker.classList.add('active');
      });
    });
    newPaperMarkers.forEach(marker => {
      if (marker.__bound) return;
      marker.__bound = true;
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        const paperId = marker.dataset.paper;
        document.querySelectorAll('.paper-list-item').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.paper-marker').forEach(m => m.classList.remove('active'));
        marker.classList.add('active');
        const listItem = document.querySelector(`.paper-list-item[data-paper="${paperId}"]`);
        if (listItem) listItem.classList.add('active');
      });
    });
  };
  
  // Ensure task titles render above markers by moving them to a high-z overlay layer
  const setupTitleOverlays = () => {
    const plot = document.getElementById('shared-plot');
    if (!plot) return;
    let layer = document.getElementById('titles-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'titles-layer';
      layer.style.position = 'absolute';
      layer.style.inset = '0';
      layer.style.pointerEvents = 'none';
      layer.style.zIndex = '200000';
      plot.appendChild(layer);
    }

    const regions = Array.from(document.querySelectorAll('.task-region'));
    const plotRect = plot.getBoundingClientRect();
    regions.forEach((region) => {
      const content = region.firstElementChild;
      if (!content || content.__movedToOverlay) return;
      const r = region.getBoundingClientRect();
      const wrapper = document.createElement('div');
      wrapper.style.position = 'absolute';
      wrapper.style.left = (r.left - plotRect.left) + 'px';
      wrapper.style.top = (r.top - plotRect.top) + 'px';
      wrapper.style.width = r.width + 'px';
      wrapper.style.height = r.height + 'px';
      wrapper.style.display = 'flex';
      wrapper.style.alignItems = 'center';
      wrapper.style.justifyContent = 'center';
      wrapper.style.textAlign = 'center';
      wrapper.style.pointerEvents = 'none';
      // Move content node into overlay wrapper
      content.__movedToOverlay = true;
      wrapper.appendChild(content);
      layer.appendChild(wrapper);
    });

    const reposition = () => {
      const plotRect = plot.getBoundingClientRect();
      const wrappers = Array.from(layer.children);
      const regions = Array.from(document.querySelectorAll('.task-region'));
      if (wrappers.length !== regions.length) return;
      regions.forEach((region, i) => {
        const r = region.getBoundingClientRect();
        const w = wrappers[i];
        w.style.left = (r.left - plotRect.left) + 'px';
        w.style.top = (r.top - plotRect.top) + 'px';
        w.style.width = r.width + 'px';
        w.style.height = r.height + 'px';
      });
    };

    // Debounced to batch continuous resizes
    const debounced = debounce(reposition, 100);
    window.addEventListener('resize', debounced);
  };
  // Paper and task interaction
  const paperListItems = document.querySelectorAll('.paper-list-item');
  const paperMarkers = document.querySelectorAll('.paper-marker');
  const taskRegions = document.querySelectorAll('.task-region');
  const filterStatus = document.getElementById('filterStatus');
  const filterText = document.getElementById('filterText');
  const clearFilter = document.getElementById('clearFilter');
  
  let currentFilter = null;

  // Gaussian marker rendering
  const getPlotRect = () => {
    const container = document.getElementById('shared-plot');
    if (!container) return { width: 0, height: 0 };
    const rect = container.getBoundingClientRect();
    // Use clientWidth/Height for stability (excludes borders/scrollbars)
    const width = container.clientWidth || rect.width;
    const height = container.clientHeight || rect.height;
    return { width, height };
  };

  // Piecewise-linear mapping from number of views to x-percent using chart ticks
  const viewsAnchors = [
    { p: 16, v: 0 },
    { p: 27, v: 1 },
    { p: 50, v: 16 },
    { p: 65, v: 32 },
    { p: 80, v: 64 },
    { p: 95, v: 100 }
  ];

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

  const viewsToPercent = (views) => {
    if (isNaN(views)) return null;
    // Clamp to bounds
    if (views <= viewsAnchors[0].v) return viewsAnchors[0].p;
    if (views >= viewsAnchors[viewsAnchors.length - 1].v) return viewsAnchors[viewsAnchors.length - 1].p;
    // Find segment
    for (let i = 0; i < viewsAnchors.length - 1; i++) {
      const a = viewsAnchors[i];
      const b = viewsAnchors[i + 1];
      if (views >= a.v && views <= b.v) {
        const t = (views - a.v) / (b.v - a.v);
        // add a small padding so the splat appears to include the tick
        const padPx = 4; // ~4px padding at each end
        const rect = getPlotRect();
        const padPct = rect.width ? (padPx / rect.width) * 100 : 0;
        const pct = a.p + t * (b.p - a.p);
        return clamp(pct, 0, 100);
      }
    }
    return null;
  };

  // Inverse mapping from x-percent to number of views using the same anchors
  const percentToViews = (pct) => {
    if (isNaN(pct)) return null;
    if (pct <= viewsAnchors[0].p) return viewsAnchors[0].v;
    if (pct >= viewsAnchors[viewsAnchors.length - 1].p) return viewsAnchors[viewsAnchors.length - 1].v;
    for (let i = 0; i < viewsAnchors.length - 1; i++) {
      const a = viewsAnchors[i];
      const b = viewsAnchors[i + 1];
      if (pct >= a.p && pct <= b.p) {
        const t = (pct - a.p) / (b.p - a.p);
        const v = a.v + t * (b.v - a.v);
        return v;
      }
    }
    return null;
  };

  const renderGaussianMarker = (marker) => {
    const rect = getPlotRect();
    if (!rect.width || !rect.height || !marker) return;

    // Remove previous svg if exists
    marker.querySelectorAll('svg.gaussian-svg').forEach(el => el.remove());

    const kSigma = parseFloat(marker.dataset.k || '3');

    // Prefer explicit extents if provided
    let xMinPct = null, xMaxPct = null, yMinPct = null, yMaxPct = null;

    if (marker.dataset.xminViews !== undefined || marker.dataset.xmaxViews !== undefined) {
      const xminViews = parseFloat(marker.dataset.xminViews);
      const xmaxViews = parseFloat(marker.dataset.xmaxViews);
      if (!isNaN(xminViews)) xMinPct = viewsToPercent(xminViews);
      if (!isNaN(xmaxViews)) xMaxPct = viewsToPercent(xmaxViews);
    }

    if (marker.dataset.xmin !== undefined) xMinPct = parseFloat(marker.dataset.xmin);
    if (marker.dataset.xmax !== undefined) xMaxPct = parseFloat(marker.dataset.xmax);
    if (marker.dataset.ymin !== undefined) yMinPct = parseFloat(marker.dataset.ymin);
    if (marker.dataset.ymax !== undefined) yMaxPct = parseFloat(marker.dataset.ymax);

    let centerLeftPct, centerBottomPct, rx, ry;

    if ([xMinPct, xMaxPct, yMinPct, yMaxPct].every(v => typeof v === 'number' && !isNaN(v))) {
      // Clamp and order
      xMinPct = clamp(xMinPct, 0, 100);
      xMaxPct = clamp(xMaxPct, 0, 100);
      yMinPct = clamp(yMinPct, 0, 100);
      yMaxPct = clamp(yMaxPct, 0, 100);
      // No special casing: 0 views maps to the 0-views tick via viewsToPercent()
      if (xMinPct > xMaxPct) [xMinPct, xMaxPct] = [xMaxPct, xMinPct];
      if (yMinPct > yMaxPct) [yMinPct, yMaxPct] = [yMaxPct, yMinPct];

      centerLeftPct = (xMinPct + xMaxPct) / 2;
      centerBottomPct = (yMinPct + yMaxPct) / 2;

      const rxPct = Math.max(0.2, (xMaxPct - xMinPct) / 2);
      const ryPct = Math.max(0.2, (yMaxPct - yMinPct) / 2);

      rx = Math.max(2, Math.round(rxPct / 100 * rect.width));
      ry = Math.max(2, Math.round(ryPct / 100 * rect.height));

      // Position the marker to the computed center using percentages (relative to plot)
      marker.style.left = centerLeftPct + '%';
      marker.style.bottom = 'auto';
      marker.style.top = (100 - centerBottomPct) + '%';
    } else {
      // Fallback to sigma percent per axis
      const sxPct = parseFloat(marker.dataset.sx || '1');
      const syPct = parseFloat(marker.dataset.sy || marker.dataset.sx || '1');

      const sigmaX = Math.max(0.001, sxPct / 100 * rect.width);
      const sigmaY = Math.max(0.001, syPct / 100 * rect.height);

      rx = Math.max(2, Math.round(kSigma * sigmaX));
      ry = Math.max(2, Math.round(kSigma * sigmaY));
      // Ensure position uses left/top (convert from bottom if present)
      const bottomPct = marker.style.bottom?.endsWith('%') ? parseFloat(marker.style.bottom) : null;
      if (bottomPct !== null && !isNaN(bottomPct)) {
        marker.style.top = (100 - bottomPct) + '%';
        marker.style.bottom = 'auto';
      }
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'gaussian-svg');
    svg.setAttribute('width', String(rx * 2));
    svg.setAttribute('height', String(ry * 2));
    svg.setAttribute('viewBox', `0 0 ${rx * 2} ${ry * 2}`);
    svg.style.overflow = 'visible';
    // Ensure the marker box size matches SVG so translate(-50%,-50%) centers correctly
    marker.style.width = String(rx * 2) + 'px';
    marker.style.height = String(ry * 2) + 'px';
    svg.style.pointerEvents = 'none';

    // Smooth radial gradient fill inside the ellipse
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradId = `g${Math.random().toString(36).slice(2)}`;
    const radial = document.createElementNS('http://www.w3.org/2000/svg', 'radialGradient');
    radial.setAttribute('id', gradId);
    radial.setAttribute('cx', '50%');
    radial.setAttribute('cy', '50%');
    radial.setAttribute('r', '50%');
    // brighter center, smoothly decreasing to edge
    const stops = [
      { o: 0.0, a: 0.45 },
      { o: 0.4, a: 0.30 },
      { o: 0.75, a: 0.15 },
      { o: 1.0, a: 0.05 }
    ];
    stops.forEach(s => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop.setAttribute('offset', `${Math.round(s.o * 100)}%`);
      stop.setAttribute('stop-color', 'currentColor');
      stop.setAttribute('stop-opacity', String(s.a));
      radial.appendChild(stop);
    });
    defs.appendChild(radial);
    svg.appendChild(defs);

    const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ellipse.setAttribute('class', 'gaussian-ellipse');
    ellipse.setAttribute('cx', String(rx));
    ellipse.setAttribute('cy', String(ry));
    ellipse.setAttribute('rx', String(rx));
    ellipse.setAttribute('ry', String(ry));
    ellipse.setAttribute('fill', `url(#${gradId})`);
    svg.appendChild(ellipse);

    const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    center.setAttribute('class', 'paper-center-dot');
    center.setAttribute('cx', String(rx));
    center.setAttribute('cy', String(ry));
    center.setAttribute('r', '2.5');
    center.setAttribute('fill', 'currentColor');
    svg.appendChild(center);

    // Insert before tooltip so tooltip sits on top
    const tooltip = marker.querySelector('.tooltip');
    if (tooltip) {
      marker.insertBefore(svg, tooltip);
    } else {
      marker.appendChild(svg);
    }
    // Set z-index based on area so smaller splats are on top
    const area = rx * ry;
    const zBase = 1000; // keep above regions
    marker.style.zIndex = String(zBase + Math.max(0, 100000 - area));

    // Brighten when active
    if (marker.classList.contains('active')) {
      // adjust gradient stops to be brighter
      const centerStop = radial.firstChild;
      if (centerStop && centerStop.setAttribute) centerStop.setAttribute('stop-opacity', '0.75');
      ellipse.setAttribute('filter', '');
      center.setAttribute('r', '3');
    }
  };

  const renderAllGaussianMarkers = () => {
    document.querySelectorAll('.paper-marker').forEach(renderGaussianMarker);
  };

  // Handle paper selection from list
  paperListItems.forEach(item => {
    item.addEventListener('click', () => {
      const paperId = item.dataset.paper;
      
      // Remove active class from all papers
      paperListItems.forEach(p => p.classList.remove('active'));
      paperMarkers.forEach(m => m.classList.remove('active'));
      
      // Add active class to clicked paper
      item.classList.add('active');
      const marker = document.querySelector(`.paper-marker[data-paper="${paperId}"]`);
      if (marker) {
        marker.classList.add('active');
      }
    });
  });

  // Handle paper marker clicks on the plot (works for both touch and mouse)
  paperMarkers.forEach(marker => {
    // Touch support for mobile
    marker.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Show tooltip on touch
      const tooltip = marker.querySelector('.tooltip');
      if (tooltip) {
        tooltip.style.opacity = '1';
        setTimeout(() => {
          tooltip.style.opacity = '';
        }, 2000);
      }
    });
    
    marker.addEventListener('click', (e) => {
      e.stopPropagation();
      const paperId = marker.dataset.paper;
      
      // Remove active class from all
      paperListItems.forEach(p => p.classList.remove('active'));
      paperMarkers.forEach(m => m.classList.remove('active'));
      
      // Add active class
      marker.classList.add('active');
      // Re-render to brighten selected marker
      renderGaussianMarker(marker);
      const listItem = document.querySelector(`.paper-list-item[data-paper="${paperId}"]`);
      if (listItem) {
        listItem.classList.add('active');
        // Scroll the paper into view in the list
        listItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  // Handle task region clicks for filtering
  taskRegions.forEach(region => {
    region.addEventListener('click', (e) => {
      // Don't trigger if clicking on a paper marker
      if (e.target.classList.contains('paper-marker')) return;
      
      const taskType = region.dataset.task;
      
      // Toggle filter
      if (currentFilter === taskType) {
        clearFilters();
      } else {
        applyFilter(taskType);
      }
    });
  });

  // Clear filter button
  if (clearFilter) {
    clearFilter.addEventListener('click', clearFilters);
  }

  function applyFilter(taskType) {
    currentFilter = taskType;
    
    // Update filter status
    const taskNames = {
      'text-to-3d': 'Text-to-3D',
      'sparse-view': 'Sparse View Synthesis',
      'nvs': 'Novel View Synthesis',
      'completion': 'Scene Completion'
    };
    
    if (filterStatus && filterText) {
      filterText.textContent = `Showing papers for: ${taskNames[taskType]} • `;
      filterStatus.classList.add('active');
    }
    
    // Filter papers in list
    paperListItems.forEach(item => {
      const paperTasks = item.querySelector('.tag')?.parentElement?.children || [];
      let hasTask = false;
      
      // Check if paper has the selected task
      for (let tag of paperTasks) {
        const tagText = tag.textContent.toLowerCase();
        if ((taskType === 'text-to-3d' && tagText.includes('text-to-3d')) ||
            (taskType === 'sparse-view' && tagText.includes('sparse view')) ||
            (taskType === 'nvs' && tagText.includes('novel view')) ||
            (taskType === 'completion' && tagText.includes('scene completion'))) {
          hasTask = true;
          break;
        }
      }
      
      if (hasTask) {
        item.classList.remove('hidden');
      } else {
        item.classList.add('hidden');
      }
    });
    
    // Filter markers on chart
    paperMarkers.forEach(marker => {
      const markerTasks = marker.dataset.tasks?.split(',') || [];
      if (markerTasks.includes(taskType)) {
        marker.classList.remove('filtered-out');
      } else {
        marker.classList.add('filtered-out');
      }
    });
    
    // Highlight active task region
    taskRegions.forEach(r => {
      r.classList.remove('active');
      if (r.dataset.task === taskType) {
        r.classList.add('active');
      }
    });
  }

  function clearFilters() {
    currentFilter = null;
    
    // Hide filter status
    if (filterStatus) {
      filterStatus.classList.remove('active');
    }
    
    // Show all papers
    paperListItems.forEach(item => {
      item.classList.remove('hidden');
    });
    
    // Show all markers
    paperMarkers.forEach(marker => {
      marker.classList.remove('filtered-out');
    });
    
    // Remove task region highlights
    taskRegions.forEach(r => r.classList.remove('active'));
  }

  // Submission Modal Logic
  const submissionModal = document.getElementById('submissionModal');
  const closeSubmissionModalBtn = document.getElementById('closeSubmissionModal');
  const plotContainer = document.getElementById('shared-plot');

  const paperIdInput = document.getElementById('paperId');
  const paperTitleInput = document.getElementById('paperTitle');
  const paperUrlInput = document.getElementById('paperUrl');
  const generatedCodeTextarea = document.getElementById('generatedCode');
  const copyCodeBtn = document.getElementById('copyCodeBtn');

  let isDrawing = false;
  let drawState = { bottom: '50', left: '50', xmin: '48', xmax: '52', ymin: '44', ymax: '56', k: '3' };
  let userMarker = null;

  const updateCodeSnippet = () => {
    const id = paperIdInput.value.trim() || '[UNIQUE_ID]';
    const title = paperTitleInput.value.trim() || '[PAPER_TITLE]';
    const url = paperUrlInput.value.trim() || '[URL]';

    // Convert drawn percent extents to view counts for x-axis in the generated snippet
    const vMin = percentToViews(parseFloat(drawState.xmin));
    const vMax = percentToViews(parseFloat(drawState.xmax));
    const vMinRounded = (vMin == null ? '' : String(Math.round(vMin)));
    const vMaxRounded = (vMax == null ? '' : String(Math.round(vMax)));

    const snippet = `/* Step 1: Add this to the papers list */
<div class="paper-list-item" data-paper="${id}">
  <h4 class="font-semibold text-gray-900">${title}</h4>
  <p class="text-sm text-gray-600 mt-1 mb-3">[Brief description]</p>
  <div class="flex flex-wrap gap-2">
    <!-- Add appropriate task tags -->
    <span class="tag bg-blue-100 text-blue-700">[Task Name]</span>
  </div>
</div>

/* Step 2: Add this paper marker to the chart (extents; no CSS positioning needed) */
<div class="paper-marker ${id}-marker" data-paper="${id}" data-tasks="[task-ids]" data-xmin-views="${vMinRounded}" data-xmax-views="${vMaxRounded}" data-ymin="${drawState.ymin}" data-ymax="${drawState.ymax}" data-k="${drawState.k}">
  <div class="tooltip">${title}</div>
</div>

/* Paper URL: ${url} */`;
    
    generatedCodeTextarea.value = snippet;
  };

  const openSubmissionModal = () => {
    submissionModal.style.display = 'flex';
    plotContainer.style.cursor = 'crosshair';
    updateCodeSnippet();
    
    // Add click listener to plot
    plotContainer.addEventListener('click', handlePlotClick);
  };

  const closeSubmissionModal = () => {
    submissionModal.style.display = 'none';
    plotContainer.style.cursor = 'default';
    
    // Remove click listener and marker
    plotContainer.removeEventListener('click', handlePlotClick);
    if (userMarker) {
      userMarker.remove();
      userMarker = null;
    }
  };

  const handlePlotClick = (e) => {
    // Don't place marker if clicking on existing elements
    if (e.target !== plotContainer && !e.target.classList.contains('task-region')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = plotContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert to percentage
    const leftPercent = (x / rect.width * 100).toFixed(1);
    const bottomPercent = ((rect.height - y) / rect.height * 100).toFixed(1);
    
    // Update or create marker
    if (!userMarker) {
      userMarker = document.createElement('div');
      userMarker.className = 'paper-marker';
      userMarker.style.color = '#dc2626';
      userMarker.style.zIndex = '30';
      userMarker.style.opacity = '1';
      userMarker.dataset.k = drawState.k;
      plotContainer.appendChild(userMarker);
    }
    
    // Default symmetrical extents around the clicked center
    const halfX = 3.0; // percent
    const halfY = 8.0; // percent

    const xmin = clamp(parseFloat(leftPercent) - halfX, 0, 100).toFixed(1);
    const xmax = clamp(parseFloat(leftPercent) + halfX, 0, 100).toFixed(1);
    const ymin = clamp(parseFloat(bottomPercent) - halfY, 0, 100).toFixed(1);
    const ymax = clamp(parseFloat(bottomPercent) + halfY, 0, 100).toFixed(1);

    drawState = {
      left: leftPercent,
      bottom: bottomPercent,
      xmin,
      xmax,
      ymin,
      ymax,
      k: drawState.k
    };

    userMarker.dataset.xmin = xmin;
    userMarker.dataset.xmax = xmax;
    userMarker.dataset.ymin = ymin;
    userMarker.dataset.ymax = ymax;
    
    // Render gaussian preview
    renderGaussianMarker(userMarker);

    updateCodeSnippet();
  };

  // Handle submit paper button click
  document.querySelectorAll('.submit-paper-btn').forEach(btn => {
    btn.addEventListener('click', openSubmissionModal);
  });

  // Form input listeners
  if (paperIdInput) {
    [paperIdInput, paperTitleInput, paperUrlInput].forEach(input => {
      input.addEventListener('input', updateCodeSnippet);
    });
  }

  // Copy button
  if (copyCodeBtn) {
    copyCodeBtn.addEventListener('click', () => {
      generatedCodeTextarea.select();
      document.execCommand('copy');
      
      const originalText = copyCodeBtn.textContent;
      copyCodeBtn.textContent = 'Copied!';
      copyCodeBtn.classList.add('bg-green-600', 'hover:bg-green-700');
      copyCodeBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
      
      setTimeout(() => {
        copyCodeBtn.textContent = originalText;
        copyCodeBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        copyCodeBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
      }, 2000);
    });
  }

  // Modal close handlers
  if (closeSubmissionModalBtn) {
    closeSubmissionModalBtn.addEventListener('click', closeSubmissionModal);
  }
  
  if (submissionModal) {
    submissionModal.addEventListener('click', (e) => {
      if (e.target === submissionModal) {
        closeSubmissionModal();
      }
    });
  }

  // Keyboard shortcut to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && submissionModal && submissionModal.style.display === 'flex') {
      closeSubmissionModal();
    }
  });

  // Initial render and resize handling for gaussian markers
  const debounce = (fn, ms = 100) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  };

  renderAllGaussianMarkers();
  ingestPapersFromTxt();
  setupTitleOverlays();
  window.addEventListener('resize', debounce(renderAllGaussianMarkers, 150));
});