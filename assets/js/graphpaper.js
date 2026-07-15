(function () {
	'use strict';

	var NAMES = ['overview', 'projects', 'resume', 'contact']; // solo indices 0-3
	var CORNERS = [
		{ x: 0, y: 0 },
		{ x: -100, y: 0 },
		{ x: 0, y: -100 },
		{ x: -100, y: -100 }
	];

	function vh() {
		if (window.innerHeight) return window.innerHeight;
		var track = document.getElementById('scrollTrack');
		return track ? track.getBoundingClientRect().height : 0;
	}
	function vw() {
		if (window.innerWidth) return window.innerWidth;
		var track = document.getElementById('scrollTrack');
		return track ? track.getBoundingClientRect().width : 0;
	}
	function lerp(a, b, t) { return a + (b - a) * t; }
	function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

	// Pick a cell size close to 32px that divides the viewport exactly, so a
	// full-bleed box's border always lands precisely on a grid line instead
	// of stopping a fraction of a cell short.
	var BASE_GRID = 32;
	function syncGridSize() {
		var w = vw(), h = vh();
		if (!w || !h) return;
		var nx = Math.max(1, Math.round(w / BASE_GRID));
		var ny = Math.max(1, Math.round(h / BASE_GRID));
		document.documentElement.style.setProperty('--grid-size-x', (w / nx) + 'px');
		document.documentElement.style.setProperty('--grid-size-y', (h / ny) + 'px');
	}

	// Same idea for the small grid-overview cards: round their target
	// (viewport-capped) size down to a whole number of the fixed 32px cells
	// those cards use, so their borders land on a grid line too.
	function syncGridCardSize() {
		var w = vw(), h = vh();
		if (!w || !h) return;
		var targetW = Math.min(w * 0.36, 440);
		var targetH = Math.min(h * 0.32, 360);
		var cardW = Math.max(BASE_GRID, Math.floor(targetW / BASE_GRID) * BASE_GRID);
		var cardH = Math.max(BASE_GRID, Math.floor(targetH / BASE_GRID) * BASE_GRID);
		var gap = Math.max(BASE_GRID, Math.round(28 / BASE_GRID) * BASE_GRID);
		document.documentElement.style.setProperty('--grid-card-w', cardW + 'px');
		document.documentElement.style.setProperty('--grid-card-h', cardH + 'px');
		document.documentElement.style.setProperty('--grid-card-gap', gap + 'px');
	}

	function init() {
		syncGridSize();
		syncGridCardSize();
		window.addEventListener('resize', syncGridSize);
		window.addEventListener('resize', syncGridCardSize);

	var isDesktop = window.matchMedia('(min-width: 861px)').matches;
	var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	var scrollTrack = document.getElementById('scrollTrack');
	var stage = document.getElementById('stage');
	var stageGrid = document.getElementById('stage-grid');
	var navDots = Array.prototype.slice.call(document.querySelectorAll('.todo-nav [data-index]'));
	var boxes = NAMES.map(function (name) {
		return document.querySelector('.box[data-box="' + name + '"]');
	});

	/* =========================
	   Intro fade-in (all breakpoints)
	   ========================= */

	window.setTimeout(function () {
		document.body.classList.remove('is-preload');
		var introInner = document.querySelector('.box[data-box="overview"] .box-inner');
		if (introInner) introInner.classList.add('fade-in');
	}, 100);

	/* =========================
	   Desktop: stage + FLIP state machine
	   ========================= */

	if (isDesktop && scrollTrack && stage && stageGrid && boxes.every(Boolean)) {
		boxes.forEach(function (box) { stageGrid.appendChild(box); });

		var mode = 'solo';
		var currentIndex = 0;
		var settleTimer = null;
		var wrapCooldown = false;

		// Arrow keys just mirror what scrolling does: down/right = forward,
		// up/left = backward, including the same wrap-at-the-ends behavior
		// as the wheel (Intro backward -> grid overview; grid backward ->
		// Contact, since that's the section right before it in scroll order;
		// grid forward -> nothing, since scrolling further down does nothing).
		var FORWARD_KEYS = { ArrowDown: true, ArrowRight: true };
		var BACKWARD_KEYS = { ArrowUp: true, ArrowLeft: true };

		function soloTransform(progress) {
			var f = Math.floor(progress);
			var c = Math.min(f + 1, 3);
			var t = progress - f;
			var x = lerp(CORNERS[f].x, CORNERS[c].x, t);
			var y = lerp(CORNERS[f].y, CORNERS[c].y, t);
			return { x: x, y: y };
		}

		function applySoloTransform(progress) {
			var pos = soloTransform(clamp(progress, 0, 3));
			stageGrid.style.transform = 'translate(' + pos.x + 'vw, ' + pos.y + 'vh)';
		}

		function setActiveDot(index) {
			navDots.forEach(function (dot) {
				var i = Number(dot.dataset.index);
				dot.classList.toggle('is-active', i === index);
				if (dot.classList.contains('todo-item')) {
					// Cross an item out once you've scrolled past it. Reaching the
					// grid overview (index 4) clears the whole list again.
					dot.classList.toggle('is-done', index < 4 && i < index);
				}
			});
		}

		function flip(elements, applyFinalState, duration) {
			var firsts = elements.map(function (el) { return el.getBoundingClientRect(); });
			applyFinalState();
			// force reflow so the new layout is committed before we measure
			// eslint-disable-next-line no-unused-expressions
			stageGrid.offsetHeight;
			var lasts = elements.map(function (el) { return el.getBoundingClientRect(); });

			elements.forEach(function (el, i) {
				var first = firsts[i];
				var last = lasts[i];
				var dx = first.left - last.left;
				var dy = first.top - last.top;
				var sx = first.width / last.width;
				var sy = first.height / last.height;
				el.style.transition = 'none';
				el.style.transformOrigin = 'top left';
				el.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sx + ', ' + sy + ')';
			});

			// eslint-disable-next-line no-unused-expressions
			stageGrid.offsetHeight;

			var dur = reduceMotion ? 0 : (duration || 700);
			elements.forEach(function (el) {
				el.style.transition = 'transform ' + dur + 'ms cubic-bezier(0.65, 0, 0.35, 1)';
				el.style.transform = 'none';
			});

			window.setTimeout(function () {
				elements.forEach(function (el) {
					el.style.transition = '';
					el.style.transform = '';
					el.style.transformOrigin = '';
				});
			}, dur + 30);
		}

		// Each box draws its own copy of the graph-paper grid so it stays legible
		// at full-viewport size. In grid-overview mode the boxes sit at arbitrary
		// pixel offsets (centered, with gaps), so their local grid falls out of
		// phase with the page's viewport-anchored grid. Re-phase each box's
		// background to whatever the true page grid looks like at that box's
		// on-screen position, so the ruling lines up seamlessly.
		var GRID_SIZE = 32;
		function alignBoxGridToPage(box) {
			var rect = box.getBoundingClientRect();
			var offsetX = ((rect.left % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
			var offsetY = ((rect.top % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
			box.style.backgroundPosition = (-offsetX) + 'px ' + (-offsetY) + 'px';
		}

		function flipToGrid() {
			mode = 'grid';
			flip(boxes, function () {
				stage.dataset.mode = 'grid';
				stageGrid.style.transform = '';
			});
			window.setTimeout(function () {
				boxes.forEach(alignBoxGridToPage);
			}, reduceMotion ? 0 : 730);
			setActiveDot(4);
		}

		function flipToSolo(targetIndex) {
			mode = 'solo';
			currentIndex = targetIndex;
			boxes.forEach(function (box) { box.style.backgroundPosition = ''; });
			flip(boxes, function () {
				stage.dataset.mode = 'solo';
				var pos = CORNERS[targetIndex];
				stageGrid.style.transform = 'translate(' + pos.x + 'vw, ' + pos.y + 'vh)';
			});
			setActiveDot(targetIndex);
		}

		function goTo(targetIndex) {
			targetIndex = clamp(targetIndex, 0, 4);
			if (targetIndex === 4) {
				if (mode === 'grid') return;
				if (currentIndex === 3) {
					// Adjacent step forward (Contact -> grid overview): let the
					// natural scroll+settle machinery drive it, same as any other
					// single-step move, so the down arrow follows the scroll into
					// the zoom instead of teleporting then animating.
					scrollTrack.scrollTo({ top: 4 * vh(), behavior: 'smooth' });
					return;
				}
				// scroll-snap-stop:always pauses at every intermediate snap point
				// along the way, so a distant programmatic jump would crawl
				// through each section instead of arriving directly. Jump the
				// scroll position instantly and let the FLIP animation (already
				// tuned) provide the motion instead.
				scrollTrack.scrollTop = 4 * vh();
				flipToGrid();
			} else if (mode === 'grid') {
				scrollTrack.scrollTop = targetIndex * vh();
				flipToSolo(targetIndex);
			} else if (Math.abs(targetIndex - currentIndex) <= 1) {
				scrollTrack.scrollTo({ top: targetIndex * vh(), behavior: 'smooth' });
			} else {
				scrollTrack.scrollTop = targetIndex * vh();
				flipToSolo(targetIndex);
			}
		}

		function onScroll() {
			var raw = scrollTrack.scrollTop / vh();
			if (mode === 'solo') {
				var clamped = clamp(raw, 0, 3);
				applySoloTransform(clamped);
				setActiveDot(Math.round(clamped));
			}

			window.clearTimeout(settleTimer);
			settleTimer = window.setTimeout(onSettle, 120);
		}

		function onSettle() {
			var raw = scrollTrack.scrollTop / vh();
			var settledIndex = clamp(Math.round(raw), 0, 4);

			if (settledIndex === 4 && mode !== 'grid') {
				flipToGrid();
			} else if (settledIndex < 4 && mode === 'grid') {
				flipToSolo(settledIndex);
			} else if (mode === 'solo') {
				currentIndex = settledIndex;
				applySoloTransform(settledIndex);
				setActiveDot(settledIndex);
			}
		}

		scrollTrack.addEventListener('scroll', onScroll, { passive: true });

		// Click a box while in grid mode -> zoom into it.
		boxes.forEach(function (box, i) {
			box.addEventListener('click', function (e) {
				if (stage.dataset.mode !== 'grid') return;
				// Let real links/buttons inside the box work without navigating first.
				if (e.target.closest('a, button, iframe')) return;
				goTo(i);
			});
		});

		// Nav dots + keyboard.
		navDots.forEach(function (dot) {
			dot.addEventListener('click', function () { goTo(Number(dot.dataset.index)); });
		});

		window.addEventListener('keydown', function (e) {
			var tag = document.activeElement && document.activeElement.tagName;
			if (tag === 'INPUT' || tag === 'TEXTAREA') return;

			if (FORWARD_KEYS[e.key]) {
				e.preventDefault();
				if (mode !== 'grid') goTo(currentIndex + 1);
			} else if (BACKWARD_KEYS[e.key]) {
				e.preventDefault();
				if (mode === 'grid') {
					goTo(3);
				} else if (currentIndex === 0) {
					goTo(4);
				} else {
					goTo(currentIndex - 1);
				}
			} else if (e.key === 'Home') {
				e.preventDefault();
				goTo(0);
			} else if (e.key === 'End' || e.key === 'Escape') {
				e.preventDefault();
				goTo(4);
			}
		});

		// At Intro (the first box), scrolling up further loops to the grid overview.
		scrollTrack.addEventListener('wheel', function (e) {
			if (mode !== 'solo' || currentIndex !== 0) return;
			if (scrollTrack.scrollTop > 1 || e.deltaY >= 0) return;
			if (wrapCooldown) return;
			wrapCooldown = true;
			window.setTimeout(function () { wrapCooldown = false; }, 800);
			scrollTrack.scrollTop = 4 * vh();
			flipToGrid();
		}, { passive: true });

		window.addEventListener('resize', function () {
			if (mode === 'grid') boxes.forEach(alignBoxGridToPage);
		});

		// Initial paint.
		applySoloTransform(0);
		setActiveDot(0);
	} else if (navDots.length) {
		/* =========================
		   Mobile: dots just scroll to the section; active state via IO
		   ========================= */

		navDots.forEach(function (dot) {
			dot.addEventListener('click', function () {
				var idx = Number(dot.dataset.index);
				var target = document.querySelectorAll('.snap-point')[idx];
				if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
			});
		});

		var points = Array.prototype.slice.call(document.querySelectorAll('.snap-point'));
		if ('IntersectionObserver' in window && points.length) {
			var io = new IntersectionObserver(function (entries) {
				entries.forEach(function (entry) {
					if (entry.isIntersecting) {
						var idx = points.indexOf(entry.target);
						navDots.forEach(function (dot) {
							var i = Number(dot.dataset.index);
							dot.classList.toggle('is-active', i === idx);
							if (dot.classList.contains('todo-item')) {
								dot.classList.toggle('is-done', i < idx);
							}
						});
					}
				});
			}, { threshold: 0.5 });
			points.forEach(function (p) { io.observe(p); });
		}
	}

	} // end init

	function safeInit(attemptsLeft) {
		// Guard against environments that report a stale/zero viewport size
		// for a frame or two right after navigation. Give up after ~1s and
		// initialize with whatever we've got rather than looping forever.
		if (!window.innerWidth && attemptsLeft > 0) {
			window.requestAnimationFrame(function () { safeInit(attemptsLeft - 1); });
			return;
		}
		init();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () { safeInit(60); });
	} else {
		safeInit(60);
	}
})();
