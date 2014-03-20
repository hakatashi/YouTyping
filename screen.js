var zeroTime = 0;
var zeroTimePad = 0;
var currentTime = 0;
var estimateSamples = new Array();

var fps = 0;
var zerocallfps = 0;

// All notes and lines will be stored in this variable and managed
// in key which represents index.
var items = {};

var setupScreen = function(deferred) {
	var screen = document.getElementById('screen');
	paper.setup(screen);

	cover = new paper.Path.Rectangle([0, 0], [1120, 630]);
	cover.fillColor = 'black';
	cover.fillColor.alpha = 0.7;

	debugTexts = [];
	for (var i = 0; i < 5; i++) {
		var index = debugTexts.push(new paper.PointText([20, 20 * (i + 1)]));
		debugText = debugTexts[index - 1];
		debugText.justification = 'left';
		debugText.fillColor = 'white';
	}

	setInterval(function() {
		debugTexts[0].content = "FPS: " + fps;
		fps = 0;
		debugTexts[2].content = "Zerocall FPS: " + zerocallfps;
		zerocallfps = 0;
		debugTexts[3].content = "Active Objects: " + paper.project.activeLayer.children.length;
	}, 1000);

	logTrace('Screen is Set.')
	deferred.resolve();
}

var loadScreen = function() {
	computeParameters();

	updateScreen();

	hitCircle = new paper.Path.Circle({
		center: [setting.hitPosition, setting.fumenYpos],
		radius: setting.noteSize,
		strokeWidth: 1,
		strokeColor: 'white'
	})

	logTrace('Screen is Ready.');
}

// Parse UTFX into fumen Object and computes various parameters like the time when the note emerges and vanishes.
function computeParameters() {
	var paddingRight = setting.width - setting.hitPosition + setting.noteSize; // distance from hit line to right edge
	var paddingLeft = setting.hitPosition + setting.noteSize; // distance from hit line to left edge

	try {
		$(fumenUTFX).each(function() {
			var tempItem = {
				time: parseFloat($(this).attr('time')),
				type: $(this).attr('type')
			};
			if ($(this).attr('text')) {
				tempItem.text = $(this).attr('text');
			}

			fumen.push(tempItem);
		});

		// Computes emerge time and vanishing time of item.
		// This is yet a very simple way without regards for speed changes.
		fumen.forEach(function(item, index) {
			item.emergeTime = (setting.speed * item.time - paddingRight) / setting.speed;
			item.vanishTime = (setting.speed * item.time + paddingLeft) / setting.speed;
		});

		logTrace('Computed Fumen Parameters.');
	} catch (error) {
		logTrace('Computing Fumen Parameters Faild: ' + error);
		loadUTFXDeferred.reject();
	}
}

var startScreen = function() {
	player.playVideo();

	paper.view.onFrame = function(event) {
		if (player.getPlayerState() == 1) {
			updateScreen();
		}
		debugTexts[4].content = 'Zero Time: ' + zeroTime.toFixed(2);
		fps++;
	}

	setInterval(function() {
		if (currentTime != player.getCurrentTime()) {
			currentTime = player.getCurrentTime();
			runTime = currentTime;
			var estimatedZero = window.performance.now() - currentTime * 1000;
			debugTexts[1].content = "Measured Zero: " + estimatedZero.toFixed(2);

			estimateSamples.push(estimatedZero);
			if (estimateSamples.length > setting.zeroEstimateSamples) estimateSamples.shift();
			var estimatedSum = estimateSamples.reduce(function(previous, current) {
				return previous + current;
			});
			zeroTimePad = estimatedSum / estimateSamples.length;

			zerocallfps++;
		}
		zeroTime = (zeroTime - zeroTimePad) * 0.9 + zeroTimePad;
	}, 10);
}

// layout notes and lines fitting to current time
function updateScreen() {
	var runTime = (window.performance.now() - zeroTime) / 1000;
	fumen.forEach(function(item, index) {
		var Xpos = (item.time - runTime) * setting.speed + setting.hitPosition;
		if (index in items) { // if indexth item exists in screen
			if (item.emergeTime > runTime || item.vanishTime < runTime) {
				items[index].remove();
				delete items[index];
			} else {
				items[index].position.x = Xpos;
			}
		} else { // if indexth item doesn't exist in screen
			if (item.emergeTime <= runTime && item.vanishTime >= runTime) {
				if (item.type == '=') {
					items[index] = new paper.Path.Line({
						from: [Xpos, setting.fumenYpos - setting.longLineHeight / 2],
						to: [Xpos, setting.fumenYpos + setting.longLineHeight / 2],
						strokeColor: 'white',
						strokeWidth: 2
					});
				}
				if (item.type == '-') {
					items[index] = new paper.Path.Line({
						from: [Xpos, setting.fumenYpos - setting.lineHeight / 2],
						to: [Xpos, setting.fumenYpos + setting.lineHeight / 2],
						strokeColor: 'white',
						strokeWidth: 1
					});
				}
				if (item.type == '+' || item.type == '*') {
					items[index] = new paper.Path.Circle({
						center: [Xpos, setting.fumenYpos],
						radius: setting.noteSize,
						strokeWidth: 1,
						strokeColor: '#aaa',
						fillColor: 'red'
					});
				}
			}
		}
	});
}
