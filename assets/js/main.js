
(function($) {

	var	$window = $(window),
		$body = $('body'),
		$sidebar = $('#sidebar');

	// Breakpoints.
		breakpoints({
			xlarge:   [ '1281px',  '1680px' ],
			large:    [ '981px',   '1280px' ],
			medium:   [ '737px',   '980px'  ],
			small:    [ '481px',   '736px'  ],
			xsmall:   [ null,      '480px'  ]
		});

	// Hack: Enable IE flexbox workarounds.
		if (browser.name == 'ie')
			$body.addClass('is-ie');

	// Play initial animations on page load.
		$window.on('load', function() {
			window.setTimeout(function() {
				$body.removeClass('is-preload');
			}, 100);
		});

	// Forms.

		// Hack: Activate non-input submits.
			$('form').on('click', '.submit', function(event) {

				// Stop propagation, default.
					event.stopPropagation();
					event.preventDefault();

				// Submit form.
					$(this).parents('form').submit();

			});
// Sidebar - Fixed Implementation
	if ($sidebar.length > 0) {

		var $sidebar_a = $sidebar.find('a');

		// Handle clicks
		$sidebar_a
			.addClass('scrolly')
			.on('click', function() {
				var $this = $(this);

				// External link? Bail.
				if ($this.attr('href').charAt(0) != '#')
					return;

				// Deactivate all links.
				$sidebar_a.removeClass('active');

				// Activate clicked link.
				$this.addClass('active');
			});

		// Handle scroll tracking
		$window.on('scroll', function() {
			var scrollTop = $window.scrollTop();
			var windowHeight = $window.height();

			$sidebar_a.each(function() {
				var $this = $(this);
				var href = $this.attr('href');
				var $section = $(href);

				// No section for this link? Skip.
				if ($section.length < 1) return;

				var sectionTop = $section.offset().top - 150;
				var sectionHeight = $section.outerHeight();
				var sectionBottom = sectionTop + sectionHeight;

				// Check if we're in this section
				if (scrollTop >= sectionTop && scrollTop < sectionBottom) {
					// Remove active from all links
					$sidebar_a.removeClass('active');
					// Add active to current section's link
					$this.addClass('active');
					
					// Remove inactive class from section for animations
					$section.removeClass('inactive');
				}
			});
		});

		// Initialize sections and set first link as active
		$sidebar_a.each(function() {
			var $this = $(this);
			var href = $this.attr('href');
			var $section = $(href);

			// Initialize section as inactive for animations
			if ($section.length > 0) {
				$section.addClass('inactive');
			}
		});

		// Set first link as active initially
		$sidebar_a.first().addClass('active');
		$($("#sidebar a").first().attr('href')).removeClass('inactive');
	}

	// Scrolly.
		$('.scrolly').scrolly({
			speed: 1000,
			offset: function() {

				// If <=large, >small, and sidebar is present, use its height as the offset.
					if (breakpoints.active('<=large')
					&&	!breakpoints.active('<=small')
					&&	$sidebar.length > 0)
						return $sidebar.height();

				return 0;

			}
		});

	// Spotlights.
		$('.spotlights > section')
			.scrollex({
				mode: 'middle',
				top: '-10vh',
				bottom: '-10vh',
				initialize: function() {

					// Deactivate section.
						$(this).addClass('inactive');

				},
				enter: function() {

					// Activate section.
						$(this).removeClass('inactive');

				}
			})
			.each(function() {

				var	$this = $(this),
					$image = $this.find('.image'),
					$img = $image.find('img'),
					x;

				// Assign image.
					$image.css('background-image', 'url(' + $img.attr('src') + ')');

				// Set background position.
					if (x = $img.data('position'))
						$image.css('background-position', x);

				// Hide <img>.
					$img.hide();

			});

	// Features.
		$('.features')
			.scrollex({
				mode: 'middle',
				top: '-20vh',
				bottom: '-20vh',
				initialize: function() {

					// Deactivate section.
						$(this).addClass('inactive');

				},
				enter: function() {

					// Activate section.
						$(this).removeClass('inactive');

				}
			});

})(jQuery);