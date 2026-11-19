const ICON_SIZE = 64;
function fitBounds(bounds, area, compact = false) {
  const width = compact ? ICON_SIZE : Math.min(Math.max(Number(bounds.width) || 1120, 760), area.width);
  const height = compact ? ICON_SIZE : Math.min(Math.max(Number(bounds.height) || 780, 520), area.height);
  const x = Number.isFinite(bounds.x) ? bounds.x : area.x + area.width - width - 20;
  const y = Number.isFinite(bounds.y) ? bounds.y : area.y + 60;
  return {x: Math.round(Math.min(Math.max(x, area.x), area.x + area.width - width)),
    y: Math.round(Math.min(Math.max(y, area.y), area.y + area.height - height)), width, height};
}
function dragBounds(start, dx, dy, area) {
  return fitBounds({...start, x:start.x + dx, y:start.y + dy}, area, true);
}
module.exports = {ICON_SIZE, fitBounds, dragBounds};
