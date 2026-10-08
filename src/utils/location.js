// Utility for location formatting and OpenStreetMap / Photon Autocomplete

// 1. Detect if a string is a virtual meeting URL
export function isOnlineMeeting(str) {
  if (!str) return false;
  const s = str.trim().toLowerCase();
  return s.startsWith('http://') || 
         s.startsWith('https://') || 
         s.includes('meet.google.com') || 
         s.includes('zoom.us') || 
         s.includes('teams.microsoft.com') || 
         s.includes('webex.com');
}

// 2. Build direct URL (either Google Maps search link or online meeting URL)
export function getLocationUrl(locationStr) {
  if (!locationStr) return null;
  const trimmed = locationStr.trim();
  if (isOnlineMeeting(trimmed)) {
    return trimmed.startsWith('http') ? trimmed : 'https://' + trimmed;
  }
  // Universal Google Maps search query
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(trimmed);
}

// 3. Render HTML badge with interactive link
export function formatLocationHtml(locationStr, defaultText = 'Online') {
  if (!locationStr || !locationStr.trim()) {
    return '<span style="color:var(--text-muted);">' + defaultText + '</span>';
  }

  const trimmed = locationStr.trim();
  const url = getLocationUrl(trimmed);

  if (isOnlineMeeting(trimmed)) {
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="color:var(--primary); font-weight:600; text-decoration:underline; display:inline-flex; align-items:center; gap:0.3rem;" title="Join online meeting">'
      + '<span>🔗</span> ' + trimmed + ' <span style="font-size:0.75rem;">↗</span>'
      + '</a>';
  }

  return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="color:inherit; text-decoration:none; display:inline-flex; align-items:center; gap:0.35rem;" title="Open in Google Maps">'
    + '<span>📍</span> <span style="text-decoration:underline;">' + trimmed + '</span> <span style="font-size:0.75rem; color:var(--primary); font-weight:600;">[Maps ↗]</span>'
    + '</a>';
}

// 4. Attach OpenStreetMap / Photon Autocomplete to an input element
export function attachLocationAutocomplete(inputEl, suggestionsBoxEl, previewBoxEl, onSelectCallback) {
  let debounceTimer = null;

  function updatePreview(val) {
    if (!previewBoxEl) return;
    if (!val || !val.trim()) {
      previewBoxEl.innerHTML = '';
      return;
    }
    const trimmed = val.trim();
    const url = getLocationUrl(trimmed);
    if (isOnlineMeeting(trimmed)) {
      previewBoxEl.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">Virtual Link: </span>'
        + '<a href="' + url + '" target="_blank" style="color:var(--primary); font-weight:600; text-decoration:underline;">Test Meeting Link ↗</a>';
    } else {
      previewBoxEl.innerHTML = '<span style="color:var(--text-muted); font-size:0.8rem;">Map Location: </span>'
        + '<a href="' + url + '" target="_blank" style="color:var(--primary); font-weight:600; text-decoration:underline;">Preview on Google Maps ↗</a>';
    }
  }

  // Initial preview on load
  if (inputEl.value) {
    updatePreview(inputEl.value);
  }

  inputEl.addEventListener('input', () => {
    const query = inputEl.value.trim();
    updatePreview(query);

    clearTimeout(debounceTimer);

    // If query is short or is an online URL, do not fetch address suggestions
    if (query.length < 3 || isOnlineMeeting(query)) {
      suggestionsBoxEl.style.display = 'none';
      suggestionsBoxEl.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(query) + '&limit=5');
        if (!res.ok) return;
        const data = await res.json();
        const features = data.features || [];

        if (features.length === 0) {
          suggestionsBoxEl.style.display = 'none';
          suggestionsBoxEl.innerHTML = '';
          return;
        }

        let itemsHtml = '';
        features.forEach((feat, idx) => {
          const p = feat.properties || {};
          const title = p.name || p.street || 'Location';
          const subParts = [
            p.housenumber ? (p.housenumber + ' ' + (p.street || '')) : p.street,
            p.city,
            p.state,
            p.country
          ].filter(Boolean);

          const fullAddress = [p.name, p.housenumber ? (p.housenumber + ' ' + (p.street || '')) : p.street, p.city, p.state, p.country]
            .filter((item, index, self) => item && self.indexOf(item) === index)
            .join(', ');

          itemsHtml += '<div class="location-suggest-item" data-address="' + fullAddress.replace(/"/g, '&quot;') + '" style="padding:0.65rem 0.85rem; cursor:pointer; border-bottom:1px solid #f1f5f9; display:flex; align-items:flex-start; gap:0.5rem; transition:background 0.15s;">'
            + '<span style="font-size:1rem; line-height:1.2;">📍</span>'
            + '<div>'
            + '<div style="font-weight:600; font-size:0.875rem; color:var(--text-primary);">' + title + '</div>'
            + '<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">' + (subParts.join(', ') || fullAddress) + '</div>'
            + '</div>'
            + '</div>';
        });

        suggestionsBoxEl.innerHTML = itemsHtml;
        suggestionsBoxEl.style.display = 'block';

        // Bind click events on suggestions
        suggestionsBoxEl.querySelectorAll('.location-suggest-item').forEach(item => {
          item.onmouseover = () => { item.style.background = '#f8fafc'; };
          item.onmouseout = () => { item.style.background = 'transparent'; };
          item.onclick = () => {
            const chosen = item.getAttribute('data-address');
            inputEl.value = chosen;
            suggestionsBoxEl.style.display = 'none';
            suggestionsBoxEl.innerHTML = '';
            updatePreview(chosen);
            if (onSelectCallback) onSelectCallback(chosen);
          };
        });

      } catch (err) {
        console.error('Location autocomplete lookup failed:', err);
      }
    }, 300);
  });

  // Hide suggestions when clicking outside
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !suggestionsBoxEl.contains(e.target)) {
      suggestionsBoxEl.style.display = 'none';
    }
  });
}
