// Toast Notifications
export function toast(message, type = 'info') {
  let stack = document.querySelector('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    document.body.appendChild(stack);
  }

  const item = document.createElement('div');
  item.className = `toast-item toast-${type}`;
  item.style.cssText = `
    background: ${type === 'danger' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
    color: #ffffff;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 0.875rem;
    font-weight: 500;
    transition: opacity 0.3s ease;
  `;
  item.innerText = message;
  stack.appendChild(item);

  setTimeout(() => {
    item.style.opacity = '0';
    setTimeout(() => item.remove(), 300);
  }, 3500);
}

// QR Code Generator URI (Zero-dependency cloud SVG/PNG)
export function generateQRCodeDataURI(text) {
  if (!text) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`;
}
