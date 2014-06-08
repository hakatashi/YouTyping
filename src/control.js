var YouTyping = function (element, settings) {
	var youTyping = this;

	/******************* Internal functions *******************/

	var setupPlayerDeferred;
	var setupPlayer = function (callback) {
		setupPlayerDeferred = $.Deferred();
		logTrace('Setting Player Up...');

		var APITag = document.createElement('script');
		APITag.src = 'https://www.youtube.com/iframe_api';
		var firstScript = document.getElementsByTagName('script')[0];
		firstScript.parentNode.insertBefore(APITag, firstScript);

		return setupPlayerDeferred.promise();
	};

	// callback function used by YouTube IFrame Player API. must be global
	onYouTubeIframeAPIReady = function () {
		var settings = youTyping.settings;

		logTrace('Player API is Ready.');

		// try to hide advertisement if sandbox parameter is 'true' or not defined in URI query
		if (getParameterByName('sandbox') === 'true') {
			this.DOM.player.setAttribute('sandbox', 'allow-same-origin allow-scripts');
		}

		youTyping.player = new YT.Player('youtyping-player', {
			height: settings.height,
			width: settings.width,
			videoId: settings.videoId,
			playerVars: {
				rel: 0,
				// Wishing the best effort of hiding any information except for the video
				controls: 0,
				showinfo: 0,
				modestbranding: 1,
				wmode: 'opaque' // thanks http://stackoverflow.com/questions/6826386/
			},
			events: {
				'onReady': onPlayerReady,
				'onStateChange': onPlayerStateChange,
				'onError': onPlayerError
			}
		});
	};

	var onPlayerReady = function (event) {
		logTrace('Player is Ready.');
		setupPlayerDeferred.resolve();
	};

	var onPlayerStateChange = function (event) {
		switch (event.data) {
			case YT.PlayerState.ENDED:
				logTrace('Player Ended.');
				break;
			case YT.PlayerState.PLAYING:
				logTrace('Player Started.');
				break;
			case YT.PlayerState.PAUSED:
				logTrace('Player Paused.');
				break;
			case YT.PlayerState.BUFFERING:
				logTrace('Player Buffering.');
				break;
			case YT.PlayerState.CUED:
				logTrace('Player Cued.');
				break;
		}
	};

	var onPlayerError = function (event) {
		// from https://developers.google.com/youtube/iframe_api_reference
		switch (event.data) {
			case 2:
				logTrace('ERROR: The request contains an invalid parameter value. For example, this error occurs if you specify a video ID that does not have 11 characters, or if the video ID contains invalid characters, such as exclamation points or asterisks.');
				break;
			case 5:
				logTrace('ERROR: The requested content cannot be played in an HTML5 player or another error related to the HTML5 player has occurred.');
				break;
			case 100:
				logTrace('ERROR: The video requested was not found. This error occurs when a video has been removed (for any reason) or has been marked as private.');
				break;
			case 101:
				logTrace('ERROR: The owner of the requested video does not allow it to be played in embedded players.');
				break;
			case 150:
				logTrace('ERROR: The owner of the requested video does not allow it to be played in embedded players.');
				break;
		}
		setupPlayerDeferred.reject();
	};

	var loadXMLDeferred;
	var loadScoreXML = function () {
		var settings = youTyping.settings;

		// Initialize deferred
		loadXMLDeferred = $.Deferred();

		$.ajax({
			url: settings.score,
			type: 'get',
			datatype: 'xml',
			timeout: 1000,
			success: function (data, textStatus, jqXHR) {
				youTyping.scoreXML = $(data).find('fumen').find('item');
				logTrace('Loaded XML File.');

				// parse XML and store into YouTyping.score
				youTyping.score = [];

				$(youTyping.scoreXML).each(function () {
				    var tempItem = {
				        time: parseFloat($(this).attr('time')),
				        type: $(this).attr('type')
				    };

				    if ($(this).attr('text')) {
				        tempItem.text = $(this).attr('text');
				    }

				    youTyping.score.push(tempItem);
				});

				loadXMLDeferred.resolve();
			},
			error: function (jqXHR, textStatus, errorThrown) {
				logTrace('ERROR: XML File Loading Failed: ' + errorThrown);
				loadXMLDeferred.reject();
			}
		});

		return loadXMLDeferred.promise();
	};


	/******************* properties *******************/

	this.startTime = Date.now();

	// score data
	this.scoreXML = null;
	this.score = null;

	// YouTube Iframe Player
	this.player = null;

	// default settings
	this.settings = {
		zeroEstimateSamples: 16, // integer
		videoId: 'fQ_m5VLhqNg',
		score: 'data.utfx',
		width: 1120, // pixel
		height: 630, // pixel
		hitPosition: 200, // pixel
		noteSize: 50, // pixel
		speed: 500, // pixel per second
		scoreYpos: 0.5, // ratio
		longLineHeight: 150, // pixel
		lineHeight: 120, // pixel
		screenPadding: 30 // pixel
	};

	// ZeroTime calculation
	this.zeroTime = 0;
	this.zeroTimePad = 0;
	this.currentTime = 0;
	this.estimateSamples = [];
	this.estimatedZero = 0; // exposed only for debugging
	this.zeroCallFPS = 0; // exposed only for debugging

	// YouTyping.now
	Object.defineProperty(this, 'now', {
		get: function () {
			return window.performance.now() || (Date.now() - youTyping.startTime);
		}
	});


	/******************* Methods *******************/

	this.play = function () {
		youTyping.player.playVideo();

		// Set interval to calculate `ZeroTime`

		/***************

		# What's `ZeroTime` and `ZeroCall`?

		The current time taken from YouTube API by `getCurrentTime()`
		is resoluted very roughly (about 0.2s) with a great range of errors (about 0.05s).

		It's so fatal for music game like YouTyping. So we introduced idea that calibrates
		correct playing time by taking average of measuring. That's `ZeroTime`.

		YouTyping loops to get current playing time from API (to `gotCurrentTime`)
		with enough interval time (10ms) to detect when the `getCurrentTime()` time jumped up to another value.
		And each time `gotCurrentTime` jumped (nameed `ZeroCall`),
		YouTyping assumes the time to be correct and counts backward to estimate when this video started,
		so the time is nameed `ZeroTime`. Then the current playing time of video will be calculated by `ZeroTime` and
		current time taken from browser clock (very highly resoluted as <1ms).

		***************/
		setInterval(function () {
			var gotCurrentTime = youTyping.player.getCurrentTime();
			var now = youTyping.now;

			if (gotCurrentTime === 0) { // if playing time is zero `ZeroTime` is immediately `now`!
				youTyping.zeroTimePad = now;
				youTyping.zeroTime = now;
			} else if (youTyping.currentTime !== gotCurrentTime) { // if Current Time jumped
				youTyping.currentTime = gotCurrentTime;
				youTyping.estimatedZero = now - youTyping.currentTime * 1000;

				// Estimated zero time is stored in estimatesamples and
				// we assume that correct zero time is average of recent
				// `zeroEstimateSamples` items of samples
				// because it contains great ranges of error.
				// We also introduced `zeroTimePad` to supress a sudden change of zeroTime.
				// It contains correct zero time and sudden-change-supressed zero time
				// will be stored in `zeroTime`.
				youTyping.estimateSamples.push(youTyping.estimatedZero);
				if (youTyping.estimateSamples.length > youTyping.settings.zeroEstimateSamples) {
					youTyping.estimateSamples.shift();
				}
				// just go hack :)
				var estimatedSum = youTyping.estimateSamples.reduce(function (previous, current) {
					return previous + current;
				});

				// `zeroTimePad` is actual estimated ZeroTime and real displayed ZeroTime is modested into `zeroTime`.
				youTyping.zeroTimePad = estimatedSum / youTyping.estimateSamples.length;

				youTyping.zeroCallFPS++;
			}
			youTyping.zeroTime = (youTyping.zeroTime - youTyping.zeroTimePad) * 0.9 + youTyping.zeroTimePad;
		}, 10);
	};

	// hit key
	this.hit = function (key, time) {
		if (!time) {
			time = youTyping.now;
		}
		var scoreTime = time - youTyping.zeroTime;
	};


	/******************* Initialization *******************/

	// override default settings
	for (var param in settings) {
		if (this.settings[param] === undefined) {
			this.settings[param] = settings[param];
		} else if (typeof this.settings[param] === 'number') {
			this.settings[param] = parseInt(settings[param], 10);
		} else {
			this.settings[param] = settings[param];
		}
	}

	// setup DOM
	/*
	 * div(this.DOM.wrap)
	 * |-div#youtyping-player(this.DOM.player)
	 * \-canvas#youtyping-screen(this.DOM.screen)
	 */
	this.DOM = {
		wrap: element.css({
			width: this.settings.width + 'px',
			height: this.settings.height + 'px',
			margin: '0 auto',
			position: 'relative'
		}),

		player: $('<div/>', {
			id: 'youtyping-player'
		}).appendTo(element).css({
			width: this.settings.width + 'px',
			height: this.settings.height + 'px',
			display: 'block',
			'z-index': 0
		}),

		screen: $('<canvas/>', {
			id: 'youtyping-screen',
			'data-paper-keepalive': 'true',
			width: this.settings.width.toString(),
			height: this.settings.height.toString()
		}).appendTo(element).css({
			width: this.settings.width + 'px',
			height: this.settings.height + 'px',
			position: 'absolute',
			top: 0,
			left: 0,
			'z-index': 100
		})
	};

	// create YouTyping screen class
	this.screen = new Screen(document.getElementById('youtyping-screen'), this);

	// Initialize asynchronously
	// http://stackoverflow.com/questions/22346345/
	$.when(
		$.when(
			loadScoreXML(),
			$.Deferred(this.screen.setup).promise()
		).done(this.screen.load),
		setupPlayer()
	).done(this.screen.ready)
	.fail(function () {
		logTrace('ERROR: Initialization Failed...');
	});
};
