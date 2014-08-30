/* youtyping-screen.js 08-30-2014 */

(function(exports){
var Screen = function (element, settings) {
	var screen = this;

	var FPS = 0;

	// All notes and lines will be stored in this variable and managed
	// in key which represents index.
	this.items = {};

	// default screen settings
	this.settings = {
		width: 1120, // pixel
		height: 630, // pixel
		hitPosition: 0.4, // ratio
		speed: 0.5, // pixel per second
		noteSize: 50, // pixel
		lyricSize: 20, // pixel
		rollYpos: 0.5, // ratio
		longLineHeight: 150, // pixel
		lineHeight: 120, // pixel
		screenPadding: 30, // pixel
		bufferTextPosition: [0.2, 0.8], // ratio in screen
		currentLyricPosition: [0.5, 0.25], // ratio in screen
		nextLyricPosition: [0.5, 0.3], // ratio in screen
		kanaLyricPosition: [0.5, 0.8], // ratio in screen
		scoreTextPosition: [0.9, 0.1], // ratio in screen
		judgeColors: {
			perfect: 'yellow',
			great: '#2d1',
			good: '#19a',
			bad: '#aaa',
			failed: '#a34',
			neglect: '#39a'
		},
		cursorHideTime: 1000, // millisecond
		onGameEnd: function () {}, // function
		highScore: 0 // number
	};

	// default YouTyping setting
	var youTypingSettings = {
		videoId: 'fQ_m5VLhqNg',
		videoStop: 0,
		dataFile: 'data.utx',
		tableFile: 'convert/romaji.xml',
		initial: false, // boolean
		correction: 0, // millisecond
		controlledCorrection: 0, // millisecond
		offset: 0, // second
		volume: 100, // percent
		playbackQuality: 'default',
		screen: screen
	};

	this.initialize = function () {
		paper.setup(screen.canvas);

		screen.cover = new paper.Path.Rectangle(paper.view.bounds);
		screen.cover.fillColor = 'black';
		screen.cover.fillColor.alpha = 0.7;

		screen.debugTexts = [];
		for (var i = 0; i < 7; i++) {
			var index = screen.debugTexts.push(new paper.PointText([20, 20 * (i + 1)]));
			screen.debugText = screen.debugTexts[index - 1];
			screen.debugText.justification = 'left';
			screen.debugText.fillColor = 'white';
		}

		screen.scoreText = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.scoreTextPosition),
			content: '0',
			fillColor: 'white',
			justification: 'right',
			fontSize: 36
		});

		screen.bufferText = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.bufferTextPosition),
			content: '',
			fillColor: 'white',
			justification: 'left',
			fontSize: 24
		});

		screen.currentLyric = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.currentLyricPosition),
			content: '',
			fillColor: 'white',
			justification: 'center',
			fontSize: 36
		});

		screen.nextLyric = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.nextLyricPosition),
			content: '',
			fillColor: 'white',
			justification: 'center',
			fontSize: 18
		});

		screen.kanaLyric = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.kanaLyricPosition),
			content: '',
			fillColor: 'white',
			justification: 'center',
			fontSize: 24
		});

		screen.judgeEffects = new paper.Group();

		setInterval(function () {
			screen.debugTexts[0].content = 'FPS: ' + FPS;
			FPS = 0;
			screen.debugTexts[2].content = 'Zerocall FPS: ' + youTyping.zeroCallFPS;
			youTyping.zeroCallFPS = 0; // not good
		}, 1000);

		screen.scorePad = 0;

		screen.highScore = screen.settings.highScore;
		screen.newRecord = false;

		logTrace('Screen Initialized.');
	};

	this.onResourceReady = function () {
		var now = youTyping.now;

		// distance from hit line to right edge
		var paddingRight = settings.width * (1 - settings.hitPosition)
		                   + settings.noteSize + settings.screenPadding;
		// distance from hit line to left edge
		var paddingLeft = settings.width * settings.hitPosition
		                  + settings.noteSize + settings.screenPadding;

		try {
			// Computes emerge time and vanishing time of item.
			// This is yet a very simple way without regards for speed changes.
			youTyping.roll.forEach(function (item, index) {
				item.emergeTime = (settings.speed * item.time - paddingRight) / settings.speed;
				item.vanishTime = (settings.speed * item.time + paddingLeft) / settings.speed;
			});

			logTrace('Computed roll Parameters.');
		} catch (error) {
			logTrace('ERROR: Computing roll Parameters Faild: ' + error);
			return -1;
		}

		youTyping.zeroTime = now;
		screen.update();

		screen.hitCircle = new paper.Path.Circle({
			center: paper.view.bounds.bottomRight.multiply([
				settings.hitPosition,
				settings.rollYpos
			]),
			radius: settings.noteSize,
			strokeWidth: 1,
			strokeColor: 'white'
		});
	};

	this.onGameReady = function () {
		screen.pressEnter = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply([0.5, 0.8]),
			content: 'Press enter or click here.',
			justification: 'center',
			fontSize: 45,
			fillColor: 'white'
		});
		var triggerStartScreen = function (event) {
			if ((event.type === 'keydown' && event.key === 'enter')
			    || event.type === 'mousedown') {
				screen.pressEnter.remove();
				paper.tool.onKeyDown = null; // unbind
				screen.start();
			}
		};
		paper.tool.onKeyDown = triggerStartScreen;
		screen.pressEnter.onMouseDown = triggerStartScreen;

		logTrace('Game is Ready.');
	};

	this.start = function () {
		logTrace('Starting game.');

		// register onFrame event
		paper.view.onFrame = screen.onFrame;

		youTyping.play();
		paper.tool.onKeyDown = triggerHitNote;
	};

	var triggerHitNote = function (event) {
		if (event.type === 'keydown' && event.key === 'escape') {
			event.preventDefault();
			screen.reset();
		}
		if (youTyping.player.getPlayerState() === 1 && event.type === 'keydown') {
			// suspend default operation on browser by keydown
			event.preventDefault();
			youTyping.hit(event.key);
		}
	};

	this.reset = function () {
		youTyping.reset();
		// remove all items
		for (var item in screen.items) {
			if (screen.items.hasOwnProperty(item)) {
				screen.items[item].remove();
			}
		}
		screen.items = {};
		screen.hitCircle.remove();
		screen.onResourceReady();
		// trigger onGameReady
		screen.onGameReady();
	};

	// layout notes and lines fitting to current time
	this.update = function () {
		var items = screen.items;

		var now = youTyping.now;
		var runTime = now - youTyping.zeroTime;

		youTyping.roll.forEach(function (item, index) {
			// X position of the item
			var position = (item.time - runTime) * settings.speed
			               + settings.width * settings.hitPosition;

			// if index-th item doesn't exists in screen
			if (!(index in items)) {
				if (item.emergeTime <= runTime && runTime <= item.vanishTime) {
					// create item
					items[index] = new paper.Group();

					// long line which devides roll to measures
					if (item.type === youTyping.itemType.LONGLINE) {
						items[index].longLine = items[index].addChild(new paper.Path.Line({
							from: [
								position,
								settings.rollYpos * settings.height - settings.longLineHeight / 2
							],
							to: [
								position,
								settings.rollYpos * settings.height + settings.longLineHeight / 2
							],
							strokeColor: 'white',
							strokeWidth: 2
						}));
					}
					// small line
					if (item.type === youTyping.itemType.LINE) {
						items[index].smallLine = items[index].addChild(new paper.Path.Line({
							from: [
								position,
								settings.rollYpos * settings.height - settings.lineHeight / 2
							],
							to: [
								position,
								settings.rollYpos * settings.height + settings.lineHeight / 2
							],
							strokeColor: 'white',
							strokeWidth: 1
						}));
					}
					if (item.type === youTyping.itemType.NOTE) {
						// note
						items[index].note = items[index].addChild(new paper.Path.Circle({
							center: [position, settings.rollYpos * settings.height],
							radius: settings.noteSize,
							strokeWidth: 1,
							strokeColor: '#aaa'
						}));
						// lyric
						items[index].lyric = items[index].addChild(new paper.PointText({
							point: [
								position,
								settings.rollYpos * settings.height + settings.noteSize + 50
							],
							content: item.remainingText,
							fillColor: 'white',
							justification: 'center',
							fontSize: settings.lyricSize,
							fontFamily: 'sans-serif'
						}));
					}
					// order stop mark
					if (item.type === youTyping.itemType.STOP) {
						items[index].orderStop = items[index].addChild(new paper.Path({
							segments: [
								[
									position,
									settings.rollYpos * settings.height - settings.noteSize - 30
								]
							],
							fillColor: 'white'
						}));
						items[index].orderStop.lineBy([10, -10]);
						items[index].orderStop.lineBy([-20, 0]);
						items[index].orderStop.closed = true;
					}
				} else {
					return;
				}
			} else { // if index-th item exists in screen
				if (runTime < item.emergeTime || item.vanishTime < runTime) {
					items[index].remove();
					delete items[index];
					return;
				}
			}

			// update item style
			if (item.type === youTyping.itemType.LONGLINE) {
				items[index].position.x = position;
			}
			if (item.type === youTyping.itemType.LINE) {
				items[index].position.x = position;
			}
			if (item.type === youTyping.itemType.STOP) {
				items[index].position.x = position;
			}
			if (item.type === youTyping.itemType.NOTE) {
				items[index].position.x = position;
				if (item.state === youTyping.noteState.CLEARED) {
					items[index].note.visible = false;
					items[index].lyric.visible = false;
				} else {
					// note
					items[index].note.style = {
						fillColor: (
							item.state === youTyping.noteState.WAITING ||
							item.state === youTyping.noteState.HITTING
						) ? 'red' : '#aaa'
					};
					items[index].note.opacity = (
						item.state === youTyping.noteState.FAILED ||
						item.state === youTyping.noteState.WAITING
					) ? 1 : 0.5;
					// lyric
					items[index].lyric.content = item.remainingText;
				}
			}
		});
	};

	this.onFrame = function (event) {
		var kanaLyric;

		if (youTyping.player.getPlayerState() === 1) {
			screen.update();
		}

		screen.debugTexts[1].content = 'Measured Zero: ' + youTyping.estimatedZero.toFixed(2);
		screen.debugTexts[3].content = 'Active Objects: ' + paper.project.activeLayer.children.length;
		screen.debugTexts[4].content = 'Zero Time: ' + youTyping.zeroTime.toFixed(2);
		screen.debugTexts[5].content = 'Time: ' + youTyping.time.toFixed(2);
		screen.bufferText.content = youTyping.inputBuffer;
		screen.currentLyric.content = youTyping.currentLyricIndex
		                              ? youTyping.roll[youTyping.currentLyricIndex].text
		                              : '';
		screen.nextLyric.content = youTyping.nextLyricIndex
		                           ? youTyping.roll[youTyping.nextLyricIndex].text
		                           : '';
		screen.scorePad += (youTyping.score - screen.scorePad) * 0.5;
		screen.scoreText.content = Math.round(screen.scorePad);
		// screen.kanaLyric.content = (kanaLyric = youTyping.getKanaLyric()) ? kanaLyric : '';

		screen.judgeEffects.children.forEach(function (judgeEffect) {
			judgeEffect.controller.onFrame();
		});

		FPS++;
	};

	var hideCursorId = null;

	// YouTube onStateChange event supplied from YouTyping
	this.onPlayerStateChange = function (event) {
		// hide mouse cursor when playing
		if (event.data === YT.PlayerState.PLAYING) {
			paper.tool.onMouseMove = function () {
				$(screen.DOM.screen).css({
					cursor: 'auto'
				});
				clearTimeout(hideCursorId);
				hideCursorId = setTimeout(function () {
					$(screen.DOM.screen).css({
						cursor: 'none'
					});
				}, settings.cursorHideTime);
			};
		} else {
			$(screen.DOM.screen).css({
				cursor: 'auto'
			});
			clearTimeout(hideCursorId);
			paper.tool.onMouseMove = null;
		}
	};

	this.onJudgement = function (event) {
		var judgeEffect = new JudgeEffect(event.judgement);
		judgeEffect.item.controller = judgeEffect;
		screen.judgeEffects.addChild(judgeEffect.item);
	};

	// judge effect object
	var JudgeEffect = function (judgement) {
		var judgeEffect = this;

		this.bornTime = new Date();

		this.item = new paper.Group();

		this.judgeColor = settings.judgeColors[judgement.judge];

		this.judge = this.item.addChild(new paper.PointText({
			point: screen.hitCircle.position.add([0, -settings.noteSize - 24]),
			content: judgement.judge,
			fillColor: this.judgeColor,
			justification: 'center',
			fontSize: 24,
			fontFamily: 'sans-serif'
		}));

		this.combo = this.item.addChild(new paper.PointText({
			point: screen.hitCircle.position.add([0, -settings.noteSize]),
			content: judgement.combo,
			fillColor: 'white',
			justification: 'center',
			fontSize: 15,
			fontFamily: 'sans-serif'
		}));

		this.initialPosition = this.item.position;

		this.onFrame = function (event) {
			this.item.position.y = this.initialPosition.y
			                       - (new Date() - this.bornTime) * 0.2;
			this.item.opacity = 1 - (new Date() - this.bornTime) * 0.001;

			if (this.item.opacity < 0) {
				this.item.remove();
			}
		};
	};

	this.onGameEnd = function () {
		logTrace('Game Ended.');

		// unbind keys
		paper.tool.onKeyDown = null;

		if (screen.highScore < youTyping.score) {
			screen.highScore = youTyping.score;
			screen.newRecord = true;
		}

		screen.resultCover = new paper.Path.Rectangle(paper.view.bounds);
		screen.resultCover.fillColor = '#ddd';
		screen.resultCover.fillColor.alpha = 0;

		screen.resultCover.onFrame = function (event) {
			this.fillColor.alpha += 0.01;
			if (this.fillColor.alpha >= 1) {
				screen.resultCover.onFrame = null;
				showResult();
			}
		};

		screen.settings.onGameEnd.call(screen);
	};

	var showResult = function () {
		var screenSize = paper.view.bounds.bottomRight;

		screen.result = [];

		screen.result.push(new paper.PointText({
			point: screenSize.multiply([0.2, 0]).add([0, 100]),
			content: 'Result:',
			fillColor: 'black',
			justification: 'left',
			fontSize: 48,
			fontFamily: 'sans-serif'
		}));

		[
			'perfect',
			'great',
			'good',
			'bad',
			'failed',
			'neglect'
		].forEach(function (judgement, index) {
			var color = new paper.Color(settings.judgeColors[judgement]);
			color.brightness -= 0.3;
			color.saturation += 0.2;

			var content = 0;

			if (judgement === 'neglect') {
				content = youTyping.scorebook.neglect;
			} else if (judgement === 'failed') {
				for (var score in youTyping.scorebook.failed) {
					if (youTyping.scorebook.failed.hasOwnProperty(score)) {
						content += youTyping.scorebook.failed[score];
					}
				}
			} else {
				content = youTyping.scorebook.cleared[judgement];
			}

			screen.result.push(new paper.PointText({
				point: screenSize.multiply([0.2, 0]).add([0, 40 * index + 180]),
				content: judgement + ': ' + content,
				fillColor: color,
				justification: 'left',
				fontSize: 36,
				fontFamily: 'sans-serif'
			}));
		});

		screen.result.push(new paper.PointText({
			point: screenSize.multiply([0.2, 0]).add([0, 450]),
			content: 'Max Combo: ' + youTyping.maxCombo,
			fillColor: 'black',
			justification: 'left',
			fontSize: 36,
			fontFamily: 'sans-serif'
		}));

		screen.result.push(new paper.PointText({
			point: screenSize.multiply([0.2, 0]).add([0, 500]),
			content: 'Score: ' + youTyping.score,
			fillColor: 'black',
			justification: 'left',
			fontSize: 36,
			fontFamily: 'sans-serif'
		}));

		screen.result.push(new paper.PointText({
			point: screenSize.multiply([0.2, 0]).add([0, 550]),
			content: 'HighScore: ' + screen.highScore,
			fillColor: 'black',
			justification: 'left',
			fontSize: 36,
			fontFamily: 'sans-serif'
		}));
	};

	// Initialization

	// override default screen settings
	for (var param in settings) {
		if (settings.hasOwnProperty(param)) {
			if (this.settings[param] === undefined) {
				this.settings[param] = settings[param];
			} else if (typeof this.settings[param] === 'number') {
				this.settings[param] = parseFloat(settings[param], 10);
			} else if (typeof this.settings[param] === 'string') {
				this.settings[param] = settings[param];
			} else if (typeof this.settings[param] === 'boolean') {
				this.settings[param] = Boolean(settings[param]);
			} else if (typeof this.settings[param] === 'function') {
				this.settings[param] = settings[param];
			} else if (typeof this.settings[param] === 'object') {
				this.settings[param] = typeof settings[param] === 'object'
				                       ? settings[param]
				                       : JSON.parse(settings[param]);
			}
		}
	}

	// override default YouTyping settings
	for (param in youTypingSettings) {
		if (youTypingSettings.hasOwnProperty(param)) {
			if (typeof this.settings[param] !== 'undefined') {
				youTypingSettings[param] = this.settings[param];
			}
		}
	}

	// shorthand
	settings = this.settings;

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
		})[0],

		player: $('<div/>', {
			id: 'youtyping-player'
		}).appendTo(element).css({
			width: this.settings.width + 'px',
			height: this.settings.height + 'px',
			display: 'block',
			'z-index': 0
		})[0],

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
		})[0]
	};

	this.canvas = this.DOM.screen;

	youTypingSettings.width = this.settings.width;
	youTypingSettings.height = this.settings.height;

	this.youTyping = new YouTyping(this.DOM.player, youTypingSettings);
	var youTyping = this.youTyping; // just a shorthand

	this.initialize();
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

// polyfill performance.now()
if (typeof window.performance === 'undefined') {
	window.performance = {};
}
if (!window.performance.now){
	var offset = Date.now();
	window.performance.now = function now(){
		return Date.now() - offset;
	};
}

// check if a string starts with specific prefix
var startsWith = function (string, prefix) {
	if (string.length < prefix.length) {
		return false;
	}
	return string.substring(0, prefix.length) === prefix;
};

// generate (hopefully unique) identifier
var generateID = function () {
	var id = '';
	for (var i = 0; i < 12; i++) {
		id += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)];
	}
	return id;
};

// http://stackoverflow.com/questions/15313418/
function assert(condition, message) {
	if (!condition) {
		message = message || 'Assertion failed';
		if (typeof Error !== 'undefined') {
			throw new Error(message);
		}
		throw message; // Fallback
	}
}

String.prototype.mapsTo = function (table) {
	for (var key in table) {
		if (table.hasOwnProperty(key)) {
			if (this.valueOf() === key) {
				return table[key];
			}
		}
	}

	return null;
};


exports.Screen = Screen;
}(typeof window === 'undefined' ? module.exports : window));