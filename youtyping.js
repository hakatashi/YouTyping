/* youtyping.js 05-30-2014 */

var YouTyping = (function(){
var YouTyping = function (element, settings) {
	var youTyping = this;

	this.startTime = Date.now();

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

	for (var param in settings) {
		if (this.settings[param] === undefined) {
			this.settings[param] = settings[param];
		} else if (typeof this.settings[param] === 'number') {
			this.settings[param] = parseInt(settings[param]);
		} else {
			this.settings[param] = settings[param];
		}
	}

	this.scoreXML = null;
	this.score = null;
	this.player = null;

	var setupPlayerDeferred;
	function setupPlayer(callback) {
		setupPlayerDeferred = $.Deferred();
		logTrace('Setting Player Up...');

		var APITag = document.createElement('script');
		APITag.src = 'https://www.youtube.com/iframe_api';
		var firstScript = document.getElementsByTagName('script')[0];
		firstScript.parentNode.insertBefore(APITag, firstScript);

		return setupPlayerDeferred.promise();
	}

	onYouTubeIframeAPIReady = function () { // global
		var settings = youTyping.settings;

		logTrace("Player API is Ready.");

		// try to hide advertisement if sandbox parameter is 'true' or not defined in URI query
		if (getParameterByName('sandbox') == 'true') {
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

	function onPlayerReady(event) {
		logTrace("Player is Ready.");
		setupPlayerDeferred.resolve();
	}

	function onPlayerStateChange(event) {
		switch (event.data) {
			case YT.PlayerState.ENDED:
				logTrace("Player Ended.");
				break;
			case YT.PlayerState.PLAYING:
				logTrace("Player Started.");
				break;
			case YT.PlayerState.PAUSED:
				logTrace("Player Paused.");
				break;
			case YT.PlayerState.BUFFERING:
				logTrace("Player Buffering.");
				break;
			case YT.PlayerState.CUED:
				logTrace("Player Cued.");
				break;
		}
	}

	function onPlayerError(event) {
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
	}

	var loadXMLDeferred;
	function loadScoreXML() {
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
				loadXMLDeferred.resolve();
			},
			error: function (jqXHR, textStatus, errorThrown) {
				logTrace('ERROR: XML File Loading Failed: ' + errorThrown);
				loadXMLDeferred.reject();
			}
		});

		return loadXMLDeferred.promise();
	}

	this.computeParameters = function () {
		var settings = this.settings;

		var paddingRight = settings.width - settings.hitPosition + settings.noteSize + settings.screenPadding; // distance from hit line to right edge
		var paddingLeft = settings.hitPosition + settings.noteSize + settings.screenPadding; // distance from hit line to left edge

		try {
			this.score = [];

			$(this.scoreXML).each(function () {
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
			this.score.forEach(function (item, index) {
				item.emergeTime = (settings.speed * item.time - paddingRight) / settings.speed;
				item.vanishTime = (settings.speed * item.time + paddingLeft) / settings.speed;
			});

			logTrace('Computed score Parameters.');
		} catch (error) {
			logTrace('ERROR: Computing score Parameters Faild: ' + error);
			loadXMLDeferred.reject();
		}
	};

	// setup DOM
	this.DOM = {
		wrap: element,
		player: $('<div/>', {
			id: 'youtyping-player'
		}).appendTo(element),
		screen: $('<canvas/>', {
			id: 'youtyping-screen',
			'data-paper-keepalive': 'true',
			width: this.settings.width.toString(),
			height: this.settings.height.toString()
		}).appendTo(element)
	};

	$(this.DOM.wrap).css({
		width: this.settings.width + 'px',
		height: this.settings.height + 'px',
		margin: '0 auto',
		position: 'relative'
	});

	$(this.DOM.player).css({
		width: this.settings.width + 'px',
		height: this.settings.height + 'px',
		display: 'block',
		'z-index': 0
	});

	$(this.DOM.screen).css({
		width: this.settings.width + 'px',
		height: this.settings.height + 'px',
		position: 'absolute',
		top: 0,
		left: 0,
		'z-index': 100
	});

	// create screen class
	this.screen = new Screen(document.getElementById('youtyping-screen'), this);

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

// All notes and lines will be stored in this variable and managed
// in key which represents index.
var items = {};

var Screen = function (canvas, youTyping) {
	var screen = this;

	var zeroTime = 0;
	var zeroTimePad = 0;
	var currentTime = 0;
	var estimateSamples = [];

	var fps = 0;
	var zerocallfps = 0;

	this.canvas = canvas;

	this.setup = function (deferred) {
		screen.canvas = canvas;
		paper.setup(screen.canvas);

		$.ajax('/don.svg').done(function (data) {
			youTyping.don = new paper.Symbol(paper.project.importSVG(data));
		});

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
			screen.debugTexts[0].content = "FPS: " + fps;
			fps = 0;
			screen.debugTexts[2].content = "Zerocall FPS: " + zerocallfps;
			zerocallfps = 0;
		}, 1000);

		logTrace('Screen is Set.');
		deferred.resolve();
	};

	this.load = function () {
		var settings = youTyping.settings;

		youTyping.computeParameters();

		screen.update();

		this.hitCircle = new paper.Path.Circle({
			center: [settings.hitPosition, settings.scoreYpos * settings.height],
			radius: settings.noteSize,
			strokeWidth: 1,
			strokeColor: 'white'
		});

		logTrace('Screen is Ready.');
	};

	this.start = function () {
		var player = youTyping.player;

		player.playVideo();

		paper.view.onFrame = function (event) {
			if (player.getPlayerState() == 1) {
				screen.update();
			}
			screen.debugTexts[3].content = "Active Objects: " + paper.project.activeLayer.children.length;
			screen.debugTexts[4].content = 'Zero Time: ' + zeroTime.toFixed(2);
			fps++;
		};

		setInterval(function () {
			if (currentTime != player.getCurrentTime()) {
				var now = window.performance.now() || (Date.now() - this.youTyping.startTime);

				currentTime = player.getCurrentTime();
				runTime = currentTime;
				var estimatedZero = now - currentTime * 1000;
				screen.debugTexts[1].content = "Measured Zero: " + estimatedZero.toFixed(2);

				// Estimated zero time is stored in estimatesamples and
				// we assume that correct zero time is recent `zeroEstimateSamples` samples
				// because it contains great ranges of error.
				// We also introduced `zeroTimePad` to supress a sudden change of zeroTime.
				// It contains correct zero time and sudden-change-supressed zero time
				// will be stored in `zeroTime`.
				estimateSamples.push(estimatedZero);
				if (estimateSamples.length > youTyping.settings.zeroEstimateSamples) estimateSamples.shift();
				var estimatedSum = estimateSamples.reduce(function (previous, current) {
					return previous + current;
				});
				zeroTimePad = estimatedSum / estimateSamples.length;

				zerocallfps++;
			}
			zeroTime = (zeroTime - zeroTimePad) * 0.9 + zeroTimePad;
		}, 10);
	};

	// layout notes and lines fitting to current time
	this.update = function () {
		var setting = youTyping.settings;

		var now = window.performance.now() || (Date.now() - this.youTyping.startTime);
		var runTime = (now - zeroTime) / 1000;

		youTyping.score.forEach(function (item, index) {
			var Xpos = (item.time - runTime) * setting.speed + setting.hitPosition;
			if (index in items) { // if index-th item exists in screen
				if (item.emergeTime > runTime || item.vanishTime < runTime) {
					items[index].remove();
					delete items[index];
				} else {
					items[index].position.x = Xpos;
				}
			} else { // if indexth item doesn't exist in screen
				if (item.emergeTime <= runTime && item.vanishTime >= runTime) {
					items[index] = new paper.Group();

					if (item.type === '=') {
						items[index].addChild(new paper.Path.Line({
							from: [Xpos, setting.scoreYpos * setting.height - setting.longLineHeight / 2],
							to: [Xpos, setting.scoreYpos * setting.height + setting.longLineHeight / 2],
							strokeColor: 'white',
							strokeWidth: 2
						}));
					}
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
						items[index].addChild(youTyping.don.place([Xpos, setting.scoreYpos * setting.height]).scale(setting.noteSize / 50 * 2));
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
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec(location.search);
	return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// from http://stackoverflow.com/questions/6466135/
function pad(str, max) {
	str = str.toString();
	return str.length < max ? pad("0" + str, max) : str;
}

return YouTyping;
}());