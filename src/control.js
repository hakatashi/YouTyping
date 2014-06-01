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
				controls: 0,
				showinfo: 0,
				modestbranding: 1,
				wmode: 'opaque'
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

		loadXMLDeferred = $.Deferred();

		$.ajax({
			url: settings.score,
			type: 'get',
			datatype: 'xml',
			timeout: 1000,
			success: function (data, textStatus, jqXHR) {
				youTyping.scoreXML = $(data).find('fumen').find('item');
				logTrace('Loaded XML File.');
				computeParameters();
				loadXMLDeferred.resolve();
			},
			error: function (jqXHR, textStatus, errorThrown) {
				logTrace('ERROR: XML File Loading Failed: ' + errorThrown);
				loadXMLDeferred.reject();
			}
		});

		return loadXMLDeferred.promise();
	};

	var computeParameters = function () {
		var settings = youTyping.settings;

		var paddingRight = settings.width - settings.hitPosition + settings.noteSize + settings.screenPadding; // distance from hit line to right edge
		var paddingLeft = settings.hitPosition + settings.noteSize + settings.screenPadding; // distance from hit line to left edge

		try {
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

			// Computes emerge time and vanishing time of item.
			// This is yet a very simple way without regards for speed changes.
			youTyping.score.forEach(function (item, index) {
				item.emergeTime = (settings.speed * item.time - paddingRight) / settings.speed;
				item.vanishTime = (settings.speed * item.time + paddingLeft) / settings.speed;
			});

			logTrace('Computed score Parameters.');
		} catch (error) {
			logTrace('ERROR: Computing score Parameters Faild: ' + error);
			loadXMLDeferred.reject();
		}
	};


	/******************* properties *******************/

	this.startTime = Date.now();

	// score data
	this.scoreXML = null;
	this.score = null;

	// YouTube IFrame Player
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
	var player = setupPlayer();
	var XML = loadScoreXML();
	var screen = $.Deferred(this.screen.setup).promise();
	$.when(
		$.when(
			XML,
			screen
		).done(this.screen.load),
		player
	).done(this.screen.start)
	.fail(function () {
		logTrace('ERROR: Initialization Failed...');
	});
};