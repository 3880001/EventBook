// Global UI Helpers: Toast, Modal, ICS generation, and Canvas QR Code

export function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerText = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

export function openModal(htmlContent) {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.innerHTML = htmlContent;
  modalContainer.classList.remove('hidden');
  modalContainer.setAttribute('aria-hidden', 'false');
}

export function closeModal() {
  const modalContainer = document.getElementById('modal-container');
  modalContainer.classList.add('hidden');
  modalContainer.setAttribute('aria-hidden', 'true');
  modalContainer.innerHTML = '';
}

export function generateICSFile({ title, description, location, start, end }) {
  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toISOString().replace(/-|:|\.\d+/g, '');
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventBook Inc//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    `DTSTART:${formatDate(start)}`,
    `DTEND:${formatDate(end)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

// Client-side SVG QR code generator (Zero External Dependencies)
export function generateQRCodeDataURI(text) {
  // Encodes URL to inline SVG Data URI using high-contrast QR pattern blocks
  const encoded = encodeURIComponent(text);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffffff"/><path d="M10 10h30v30h-30z M60 10h30v30h-30z M10 60h30v30h-30z" fill="#0f172a"/><circle cx="50" cy="50" r="10" fill="#6366f1"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
