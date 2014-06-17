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

		screen.bufferText = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(youTyping.settings.bufferTextPosition),
			content: '',
			fillColor: 'white',
			justification: 'left',
			fontSize: 24
		});

		screen.currentLyric = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(youTyping.settings.currentLyricPosition),
			content: '',
			fillColor: 'white',
			justification: 'center',
			fontSize: 36
		});

		screen.nextLyric = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(youTyping.settings.nextLyricPosition),
			content: '',
			fillColor: 'white',
			justification: 'center',
			fontSize: 18
		});

		screen.judgeEffects = new paper.Group();

		setInterval(function () {
			screen.debugTexts[0].content = 'FPS: ' + FPS;
			FPS = 0;
			screen.debugTexts[2].content = 'Zerocall FPS: ' + youTyping.zeroCallFPS;
			youTyping.zeroCallFPS = 0; // not good
		}, 1000);

		logTrace('Screen is Set.');
		deferred.resolve();
	};

	this.load = function (deffered) {
		var settings = youTyping.settings;
		var now = youTyping.now;

		var paddingRight = settings.width * (1 - settings.hitPosition) + settings.noteSize + settings.screenPadding; // distance from hit line to right edge
		var paddingLeft = settings.width * settings.hitPosition + settings.noteSize + settings.screenPadding; // distance from hit line to left edge

		try {
			// Computes emerge time and vanishing time of item.
			// This is yet a very simple way without regards for speed changes.
			youTyping.score.forEach(function (item, index) {
				item.emergeTime = (settings.speed * item.time - paddingRight) / settings.speed;
				item.vanishTime = (settings.speed * item.time + paddingLeft) / settings.speed;
			});

			logTrace('Computed score Parameters.');
		} catch (error) {
			logTrace('ERROR: Computing score Parameters Faild: ' + error);
			return -1;
		}

		youTyping.zeroTime = now;
		screen.update();

		screen.hitCircle = new paper.Path.Circle({
			center: paper.view.bounds.bottomRight.multiply([settings.hitPosition, settings.scoreYpos]),
			radius: settings.noteSize,
			strokeWidth: 1,
			strokeColor: 'white'
		});
	};

	this.ready = function () {
		screen.pressEnter = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply([0.5, 0.8]),
			content: 'Press enter or click here.',
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

		// register onFrame event
		paper.view.onFrame = screen.onFrame;

		youTyping.play();

		var triggerHitNote = function (event) {
			if (youTyping.player.getPlayerState() === 1 && event.type === 'keydown') {
				// suspend default operation on browser by keydown
				event.preventDefault();
				youTyping.hit(event.key);
			}
		};
		paper.tool.onKeyDown = triggerHitNote;
	};

	// layout notes and lines fitting to current time
	this.update = function () {
		var setting = youTyping.settings;
		var items = screen.items;

		var now = youTyping.now;
		var runTime = now - youTyping.zeroTime;

		youTyping.score.forEach(function (item, index) {
			// X position of the item
			var position = (item.time - runTime) * setting.speed + setting.width * setting.hitPosition;

			// if index-th item doesn't exists in screen
			if (!(index in items)) {
				if (item.emergeTime <= runTime && runTime <= item.vanishTime) {
					// create item
					items[index] = new paper.Group();

					// long line which devides score to measures
					if (item.type === '=') {
						items[index].longLine = items[index].addChild(new paper.Path.Line({
							from: [position, setting.scoreYpos * setting.height - setting.longLineHeight / 2],
							to: [position, setting.scoreYpos * setting.height + setting.longLineHeight / 2],
							strokeColor: 'white',
							strokeWidth: 2
						}));
					}
					// small line
					if (item.type === '-') {
						items[index].smallLine = items[index].addChild(new paper.Path.Line({
							from: [position, setting.scoreYpos * setting.height - setting.lineHeight / 2],
							to: [position, setting.scoreYpos * setting.height + setting.lineHeight / 2],
							strokeColor: 'white',
							strokeWidth: 1
						}));
					}
					if (item.type === '+') {
						// note
						items[index].note = items[index].addChild(new paper.Path.Circle({
							center: [position, setting.scoreYpos * setting.height],
							radius: setting.noteSize,
							strokeWidth: 1,
							strokeColor: '#aaa'
						}));
						// lyric
						items[index].lyric = items[index].addChild(new paper.PointText({
							point: [position, setting.scoreYpos * setting.height + setting.noteSize + 50],
							content: item.remainingText,
							fillColor: 'white',
							justification: 'center',
							fontSize: 20,
							fontFamily: 'sans-serif'
						}));
					}
					// order stop mark
					if (item.type === '/') {
						items[index].orderStop = items[index].addChild(new paper.Path({
							segments: [[position, setting.scoreYpos * setting.height - setting.noteSize - 30]],
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
			if (item.type === '=') {
				items[index].position.x = position;
			}
			if (item.type === '-') {
				items[index].position.x = position;
			}
			if (item.type === '/') {
				items[index].position.x = position;
			}
			if (item.type === '+') {
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
		if (youTyping.player.getPlayerState() === 1) {
			screen.update();
		}
		screen.debugTexts[1].content = 'Measured Zero: ' + youTyping.estimatedZero.toFixed(2);
		screen.debugTexts[3].content = 'Active Objects: ' + paper.project.activeLayer.children.length;
		screen.debugTexts[4].content = 'Zero Time: ' + youTyping.zeroTime.toFixed(2);
		screen.bufferText.content = youTyping.inputBuffer;
		screen.currentLyric.content = youTyping.currentLyricIndex ? youTyping.score[youTyping.currentLyricIndex].text : '';
		screen.nextLyric.content = youTyping.nextLyricIndex ? youTyping.score[youTyping.nextLyricIndex].text : '';

		screen.judgeEffects.children.forEach(function (judgeEffect) {
			judgeEffect.controller.onFrame();
		});

		FPS++;
	};

	// YouTube onStateChange event supplied from YouTyping
	this.onPlayerStateChange = function (event) {
		// hide mouse cursor when playing
		if (event.data === YT.PlayerState.PLAYING) {
			youTyping.DOM.screen.css({
				cursor: 'none'
			});
		} else {
			youTyping.DOM.screen.css({
				cursor: 'auto'
			});
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
		var settings = youTyping.settings;

		this.item = new paper.Group();

		this.judgeColor = '';
		switch (judgement.judge) {
		case 'perfect':
			this.judgeColor = 'yellow'; break;
		case 'great':
			this.judgeColor = '#2d1'; break;
		case 'good':
			this.judgeColor = '#19a'; break;
		case 'bad':
			this.judgeColor = '#aaa'; break;
		}

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

		this.onFrame = function (event) {
			this.item.translate([0, -3]);
			this.item.opacity -= 0.02;

			if (this.item.opacity < 0) {
				this.item.remove();
			}
		};
	};
};
