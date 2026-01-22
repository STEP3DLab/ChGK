// Canvas wheel rendering and simple spin animation.
let animationFrame = null;

export const initWheel = (canvas) => {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const size = canvas.width = 360;
  canvas.height = 360;

  const draw = (segments = 12, angle = 0) => {
    ctx.clearRect(0, 0, size, size);
    const radius = size / 2 - 8;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(angle);
    for (let i = 0; i < segments; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.fillStyle = i % 2 === 0 ? "#1f1f1f" : "#0f0f0f";
      ctx.arc(0, 0, radius, (i * 2 * Math.PI) / segments, ((i + 1) * 2 * Math.PI) / segments);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.strokeStyle = "#f5f5f5";
    ctx.lineWidth = 2;
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = "#f5f5f5";
    ctx.moveTo(size / 2, 6);
    ctx.lineTo(size / 2 - 10, 30);
    ctx.lineTo(size / 2 + 10, 30);
    ctx.closePath();
    ctx.fill();
  };

  draw();

  return { canvas, ctx, draw };
};

export const spinWheel = (wheel, ids) => {
  if (!wheel) return ids[Math.floor(Math.random() * ids.length)];
  const segments = Math.max(ids.length, 8);
  const targetIndex = Math.floor(Math.random() * ids.length);
  const targetId = ids[targetIndex];
  let angle = 0;
  let velocity = 0.4 + Math.random() * 0.6;

  const animate = () => {
    angle += velocity;
    velocity *= 0.985;
    wheel.draw(segments, angle);
    if (velocity > 0.005) {
      animationFrame = requestAnimationFrame(animate);
    }
  };

  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animate);
  return targetId;
};
