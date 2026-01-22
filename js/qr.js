// QR rendering helper with graceful fallback.
export const renderQrCode = (container, text) => {
  if (!container) return;
  container.innerHTML = "";
  if (window.QRCode) {
    const qr = new window.QRCode(container, { text, width: 120, height: 120 });
    if (qr.makeCode) qr.makeCode(text);
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 120;
  canvas.height = 120;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 120, 120);
  ctx.fillStyle = "#111";
  ctx.font = "12px monospace";
  ctx.fillText("QR", 50, 60);
  ctx.fillText("offline", 36, 78);
  container.appendChild(canvas);
};
