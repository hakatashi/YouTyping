// Class Screen defines canvas part of YouTyping.
// One YouTyping have one Screen as child, and vice versa.
var Screen = function (canvas, youTyping) {
	var screen = this;

	var zeroTime = 0;
	var zeroTimePad = 0;
	var currentTime = 0;
	var estimateSamples = [];

	var fps = 0;
	var zerocallfps = 0;

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
			screen.debugTexts[0].content = 'FPS: ' + fps;
			fps = 0;
			screen.debugTexts[2].content = 'Zerocall FPS: ' + zerocallfps;
			zerocallfps = 0;
		}, 1000);

		logTrace('Screen is Set.');
		deferred.resolve();
	};

	this.load = function () {
		var settings = youTyping.settings;

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
			if (player.getPlayerState() === 1) {
				screen.update();
			}
			screen.debugTexts[3].content = 'Active Objects: ' + paper.project.activeLayer.children.length;
			screen.debugTexts[4].content = 'Zero Time: ' + zeroTime.toFixed(2);
			fps++;
		};

		setInterval(function () {
			if (currentTime !== player.getCurrentTime()) {
				var now = window.performance.now() || (Date.now() - this.youTyping.startTime);

				currentTime = player.getCurrentTime();
				runTime = currentTime;
				var estimatedZero = now - currentTime * 1000;
				screen.debugTexts[1].content = 'Measured Zero: ' + estimatedZero.toFixed(2);

				// Estimated zero time is stored in estimatesamples and
				// we assume that correct zero time is recent `zeroEstimateSamples` samples
				// because it contains great ranges of error.
				// We also introduced `zeroTimePad` to supress a sudden change of zeroTime.
				// It contains correct zero time and sudden-change-supressed zero time
				// will be stored in `zeroTime`.
				estimateSamples.push(estimatedZero);
				if (estimateSamples.length > youTyping.settings.zeroEstimateSamples) {
					estimateSamples.shift();
				}
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
		var items = this.items;

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