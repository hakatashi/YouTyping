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

	this.load = function (deffered) {
		var settings = youTyping.settings;
		var now = youTyping.now;

		var paddingRight = settings.width - settings.hitPosition + settings.noteSize + settings.screenPadding; // distance from hit line to right edge
		var paddingLeft = settings.hitPosition + settings.noteSize + settings.screenPadding; // distance from hit line to left edge

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
		}

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
