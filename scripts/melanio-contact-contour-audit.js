(async () => {
  const [{ BUILT_IN_FIGHTERS }, { preloadAssets, spriteFrameSource }, attack] = await Promise.all([
    import('/shared/content.ts'),
    import('/src/game/assets.ts'),
    import('/src/game/finales/melanio.ts'),
  ]);
  const assets = await preloadAssets(BUILT_IN_FIGHTERS.map(f => f.id), ['poliedro']);
  const results = [];
  for (const fighter of BUILT_IN_FIGHTERS) {
    const sprite = assets.sprites[fighter.id];
    const frame = sprite.frames[sprite.battleFrame];
    const height = 300 * (fighter.displayHeight ?? 177) / 177;
    const scale = height / sprite.bodyHeight;
    const visibleHeight = frame.height * scale;
    const pose = visibleHeight >= -attack.MELANIO_PHONE['strike-high'].y + 35 ? 'strike-high' : 'strike-low';
    const drop = -attack.MELANIO_PHONE[pose].y;
    const contact = attack.melanioRivalContact(sprite, height, drop);
    const source = spriteFrameSource(sprite, sprite.battleFrame);
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source.image, source.x, source.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
    const flip = -sprite.frameFacing[sprite.battleFrame];
    const x = Math.round(contact.x / flip / scale - frame.x + frame.slotX + sprite.cellWidth / 2);
    const y = Math.round(frame.height + contact.y / scale);
    const inBounds = Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x < frame.width && y >= 0 && y < frame.height;
    const alpha = inBounds ? ctx.getImageData(x, y, 1, 1).data[3] : 0;
    results.push({ fighter: fighter.id, pose, visibleHeight, contact, pixel: { x, y, alpha }, passed: inBounds && alpha >= 100 });
  }
  window.melanioContourAudit = { passed: results.every(r => r.passed), results };
  return { total: results.length, passed: results.filter(r => r.passed).length, failures: results.filter(r => !r.passed) };
})();
