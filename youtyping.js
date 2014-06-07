/* youtyping.js 06-07-2014 */

var YouTyping = (function(){
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

	// utility
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

// Class Screen defines canvas part of YouTyping.
// One YouTyping have only one Screen as child, and vice versa.
var Screen = function (canvas, youTyping) {
	var screen = this;

	var FPS = 0;

	this.canvas = canvas;

	// All notes and lines will be stored in this variable and managed
	// in key which represents index.
	this.items = {};

	this.setup = function (deferred) {
		paper.setup(screen.canvas);

		screen.cover = new paper.Path.Rectangle(paper.view.bounds);
		screen.cover.fillColor = 'black';
		screen.cover.fillColor.alpha = 0.7;

		screen.debugTexts = [];
		for (var i = 0; i < 5; i++) {
			var index = screen.debugTexts.push(new paper.PointText([20, 20 * (i + 1)]));
			screen.debugText = screen.debugTexts[index - 1];
			screen.debugText.justification = 'left';
			screen.debugText.fillColor = 'white';
		}

		setInterval(function () {
			screen.debugTexts[0].content = 'FPS: ' + FPS;
			FPS = 0;
			screen.debugTexts[2].content = 'Zerocall FPS: ' + youTyping.zeroCallFPS;
			youTyping.zeroCallFPS = 0; // not good
		}, 1000);

		logTrace('Screen is Set.');
		deferred.resolve();
	};

	this.load = function () {
		var settings = youTyping.settings;
		var now = youTyping.now;

		youTyping.zeroTime = now;
		screen.update();

		this.hitCircle = new paper.Path.Circle({
			center: [settings.hitPosition, settings.scoreYpos * settings.height],
			radius: settings.noteSize,
			strokeWidth: 1,
			strokeColor: 'white'
		});
	};

	this.ready = function () {
		screen.pressEnter = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply([0.5, 0.8]),
			content: 'Press enter or click.',
			justification: 'center',
			fontSize: 45,
			fillColor: 'white'
		});
		var triggerStartScreen = function (event) {
			if ((event.type === 'keydown' && event.key === 'enter') || event.type === 'mousedown') {
				screen.pressEnter.remove();
				paper.tool.onKeyDown = null; // unbind
				screen.start();
			}
		};
		paper.tool.onKeyDown = triggerStartScreen;
		screen.pressEnter.onMouseDown = triggerStartScreen;

		logTrace('Screen is Ready.');
	};

	this.start = function () {
		logTrace('Starting game.');

		paper.view.onFrame = function (event) {
			if (youTyping.player.getPlayerState() === 1) {
				screen.update();
			}
			screen.debugTexts[1].content = 'Measured Zero: ' + youTyping.estimatedZero.toFixed(2);
			screen.debugTexts[3].content = 'Active Objects: ' + paper.project.activeLayer.children.length;
			screen.debugTexts[4].content = 'Zero Time: ' + youTyping.zeroTime.toFixed(2);
			FPS++;
		};

		youTyping.play();
	};

	// layout notes and lines fitting to current time
	this.update = function () {
		var setting = youTyping.settings;
		var items = this.items;

		var now = youTyping.now;
		var runTime = (now - youTyping.zeroTime) / 1000;

		youTyping.score.forEach(function (item, index) {
			var Xpos = (item.time - runTime) * setting.speed + setting.hitPosition;
			if (index in items) { // if index-th item exists in screen
				if (item.emergeTime > runTime || item.vanishTime < runTime) {
					items[index].remove();
					delete items[index];
				} else {
					items[index].position.x = Xpos;
				}
			} else { // if index-th item doesn't exist in screen
				if (item.emergeTime <= runTime && item.vanishTime >= runTime) {
					items[index] = new paper.Group();

					// long line which devides score to measures
					if (item.type === '=') {
						items[index].addChild(new paper.Path.Line({
							from: [Xpos, setting.scoreYpos * setting.height - setting.longLineHeight / 2],
							to: [Xpos, setting.scoreYpos * setting.height + setting.longLineHeight / 2],
							strokeColor: 'white',
							strokeWidth: 2
						}));
					}
					// small line
					if (item.type === '-') {
						items[index].addChild(new paper.Path.Line({
							from: [Xpos, setting.scoreYpos * setting.height - setting.lineHeight / 2],
							to: [Xpos, setting.scoreYpos * setting.height + setting.lineHeight / 2],
							strokeColor: 'white',
							strokeWidth: 1
						}));
					}
					if (item.type === '+') {
						// note
						items[index].addChild(new paper.Path.Circle({
							center: [Xpos, setting.scoreYpos * setting.height],
							radius: setting.noteSize,
							strokeWidth: 1,
							strokeColor: '#aaa',
							fillColor: 'red'
						}));
						// lyric
						items[index].addChild(new paper.PointText({
							position: [Xpos, setting.scoreYpos * setting.height + setting.noteSize + 50],
							content: item.text,
							fillColor: 'white',
							justification: 'center',
							fontSize: 20,
							fontFamily: 'sans-serif'
						}));
					}
				}
			}
		});
	};
};


function logTrace(text) {
	var time = new Date();
	var hh = pad(time.getHours(), 2);
	var mm = pad(time.getMinutes(), 2);
	var ss = pad(time.getSeconds(), 2);
	var lll = pad(time.getMilliseconds(), 3);
	$('#debug').append('[' + hh + ':' + mm + ':' + ss + '.' + lll + '] ' + text + '\n');
	console.log(text);
}

// from http://stackoverflow.com/questions/901115/
function getParameterByName(name) {
	name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
		results = regex.exec(location.search);
	return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// from http://stackoverflow.com/questions/6466135/
function pad(str, max) {
	str = str.toString();
	return str.length < max ? pad('0' + str, max) : str;
}

return YouTyping;
}());