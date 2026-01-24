// Canvas wheel rendering and simple spin animation.
let animationFrame = null;

export const initWheel = (canvas) => {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  const size = canvas.width = 360;
  canvas.height = 360;
  const accent = getComputedStyle(canvas).getPropertyValue("--accent").trim() || "#7df9ff";

  // Draw wheel segments and highlight the selected one for clarity.
  const draw = (segments = 12, angle = 0, selectedIndex = null) => {
    ctx.clearRect(0, 0, size, size);
    const radius = size / 2 - 8;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(angle);
    for (let i = 0; i < segments; i += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const isSelected = selectedIndex === i;
      ctx.fillStyle = isSelected ? accent : i % 2 === 0 ? "#1f1f1f" : "#0f0f0f";
      if (isSelected) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 16;
      } else {
        ctx.shadowBlur = 0;
      }
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

  return {
    canvas,
    ctx,
    draw,
    state: {
      angle: 0,
      selectedIndex: null,
      segments: 12,
    },
  };
};

export const spinWheel = (wheel, ids) => {
  if (!wheel) return ids[Math.floor(Math.random() * ids.length)];
  const segments = Math.max(ids.length, 8);
  const targetIndex = Math.floor(Math.random() * ids.length);
  const targetId = ids[targetIndex];
  // Align the chosen segment under the pointer with eased animation.
  const slice = (Math.PI * 2) / segments;
  const startAngle = wheel.state?.angle ?? 0;
  const normalizedStart = ((startAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const baseAngle = -Math.PI / 2 - (targetIndex + 0.5) * slice;
  const offset = ((baseAngle - normalizedStart) + Math.PI * 2) % (Math.PI * 2);
  const spins = 3 + Math.floor(Math.random() * 2);
  const totalRotation = spins * Math.PI * 2 + offset;
  const finalAngle = startAngle + totalRotation;
  const duration = 2400 + Math.random() * 600;
  const startedAt = performance.now();

  const animate = () => {
    const now = performance.now();
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const angle = startAngle + totalRotation * eased;
    wheel.draw(segments, angle, targetIndex);
    if (wheel.state) {
      wheel.state.angle = angle;
      wheel.state.selectedIndex = targetIndex;
      wheel.state.segments = segments;
    }
    if (progress < 1) {
      animationFrame = requestAnimationFrame(animate);
    } else {
      wheel.draw(segments, finalAngle, targetIndex);
    }
  };

  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(animate);
  return targetId;
};
