const SWIPE_THRESHOLD = 110; // px of drag to commit a swipe action
const TAP_MOVE_THRESHOLD = 10; // px; below this, release counts as a tap

const STAMP_LABELS = { archive: 'Archive', delete: 'Delete', star: 'Star', unread: 'Unread' };

export class CardStack {
  constructor(container, handlers) {
    this.container = container;
    this.handlers = handlers; // { onSwipe(direction), onTapLeft(), onTapRight() }
  }

  render(cardData) {
    this.container.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'card';

    const header = document.createElement('div');
    header.className = 'card-header';

    const rowTop = document.createElement('div');
    rowTop.className = 'row-top';
    const sender = document.createElement('div');
    sender.className = 'sender';
    sender.textContent = cardData.from || '(unknown sender)';
    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = formatDate(cardData.internalDate, cardData.dateHeader);
    rowTop.append(sender, date);

    const subject = document.createElement('div');
    subject.className = 'subject';
    subject.textContent = cardData.subject;

    const metaRow = document.createElement('div');
    metaRow.className = 'meta-row';
    if (cardData.unread) {
      const b = document.createElement('span');
      b.className = 'attachment-badge';
      b.textContent = '● Unread';
      metaRow.appendChild(b);
    }
    if (cardData.hasAttachments) {
      const b = document.createElement('span');
      b.className = 'attachment-badge';
      b.textContent = '📎 Attachment';
      metaRow.appendChild(b);
    }

    const tapLeft = document.createElement('div');
    tapLeft.className = 'tap-zone tap-zone-left';
    const tapRight = document.createElement('div');
    tapRight.className = 'tap-zone tap-zone-right';
    header.append(rowTop, subject, metaRow, tapLeft, tapRight);

    const iframe = document.createElement('iframe');
    iframe.className = 'card-body-frame';
    iframe.setAttribute('sandbox', ''); // no scripts, no same-origin, no forms/popups
    iframe.setAttribute('scrolling', 'yes');
    iframe.srcdoc = buildBodyDoc(cardData.bodyHtml, cardData.bodyText);

    card.append(header, iframe);

    for (const type of ['archive', 'delete', 'star', 'unread']) {
      const stamp = document.createElement('div');
      stamp.className = `stamp stamp-${type}`;
      stamp.textContent = STAMP_LABELS[type];
      card.appendChild(stamp);
    }

    this.container.appendChild(card);
    // Header is the drag/tap handle; the body iframe is left untouched so
    // it can scroll natively — an overlay spanning the whole card would
    // sit on top of the iframe and swallow every scroll touch.
    this._attachGestures(card, header, tapLeft, tapRight);
    return card;
  }

  _attachGestures(card, header, tapLeft, tapRight) {
    const stampEls = {
      archive: card.querySelector('.stamp-archive'),
      delete: card.querySelector('.stamp-delete'),
      star: card.querySelector('.stamp-star'),
      unread: card.querySelector('.stamp-unread'),
    };

    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;
    let dragging = false;
    let moved = false;

    const updateStamps = (x, y) => {
      const clamp = (v) => Math.max(0, Math.min(1, v / SWIPE_THRESHOLD));
      stampEls.archive.style.opacity = x > 0 ? clamp(x) : 0;
      stampEls.delete.style.opacity = x < 0 ? clamp(-x) : 0;
      stampEls.star.style.opacity = y < 0 ? clamp(-y) : 0;
      stampEls.unread.style.opacity = y > 0 ? clamp(y) : 0;
    };

    const onStart = (x, y) => {
      startX = x;
      startY = y;
      dx = 0;
      dy = 0;
      dragging = true;
      moved = false;
      card.style.transition = 'none';
    };

    const onMove = (x, y) => {
      if (!dragging) return;
      dx = x - startX;
      dy = y - startY;
      if (Math.abs(dx) > TAP_MOVE_THRESHOLD || Math.abs(dy) > TAP_MOVE_THRESHOLD) moved = true;
      card.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 20}deg)`;
      updateStamps(dx, dy);
    };

    const onEnd = () => {
      if (!dragging) return;
      dragging = false;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (!moved) {
        card.style.transform = '';
        return;
      }

      if (absX > absY && absX > SWIPE_THRESHOLD) {
        this._commitSwipe(card, dx > 0 ? 'right' : 'left');
        return;
      }
      if (absY > absX && absY > SWIPE_THRESHOLD) {
        this._commitSwipe(card, dy > 0 ? 'down' : 'up');
        return;
      }

      card.style.transition = 'transform 0.25s ease';
      card.style.transform = '';
      updateStamps(0, 0);
    };

    header.addEventListener('touchstart', (e) => {
      if (dragging) return;
      const t = e.touches[0];
      onStart(t.clientX, t.clientY);
    }, { passive: true });
    header.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      onMove(t.clientX, t.clientY);
    }, { passive: true });
    header.addEventListener('touchend', onEnd, { passive: true });

    header.addEventListener('mousedown', (e) => {
      if (dragging) return;
      onStart(e.clientX, e.clientY);
      const onMouseMove = (ev) => onMove(ev.clientX, ev.clientY);
      const onMouseUp = () => {
        onEnd();
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    tapLeft.addEventListener('click', () => {
      if (!moved) this.handlers.onTapLeft();
    });
    tapRight.addEventListener('click', () => {
      if (!moved) this.handlers.onTapRight();
    });
  }

  _commitSwipe(card, direction) {
    const fly = 600;
    const targets = {
      right: `translate(${fly}px, 0) rotate(20deg)`,
      left: `translate(${-fly}px, 0) rotate(-20deg)`,
      up: `translate(0, ${-fly}px)`,
      down: `translate(0, ${fly}px)`,
    };
    card.style.transition = 'transform 0.3s ease-out';
    card.style.transform = targets[direction];
    card.style.pointerEvents = 'none';
    this.handlers.onSwipe(direction);
  }
}

function formatDate(internalDate, fallbackHeader) {
  const d = internalDate ? new Date(internalDate) : fallbackHeader ? new Date(fallbackHeader) : null;
  if (!d || isNaN(d.getTime())) return '';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function buildBodyDoc(bodyHtml, bodyText) {
  const content = bodyHtml
    ? bodyHtml
    : `<pre style="white-space:pre-wrap;font-family:-apple-system,sans-serif;margin:0;">${escapeHtml(bodyText || '(no content)')}</pre>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 14px; word-wrap: break-word; overflow-wrap: break-word; font-size: 15px; line-height: 1.4; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  a { color: #1a73e8; }
</style></head><body>${content}</body></html>`;
}
