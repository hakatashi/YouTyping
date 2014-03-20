var zeroTime = 0;
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
	for (var i = 0; i < 4; i++) {
		var index = debugTexts.push(new paper.PointText([30, 30 + 30 * i]));
		debugText = debugTexts[index - 1];
		debugText.justification = 'left';
		debugText.fillColor = 'white';
	}

	setInterval(function() {
		debugTexts[0].content = "FPS: " + fps;
		fps = 0;
		debugTexts[2].content = "Zerocall FPS: " + zerocallfps;
		zerocallfps = 0;
	}, 1000);

	logTrace('Screen is Set.')
	deferred.resolve();
}

var loadScreen = function() {
	computeParameters();

	circle = new paper.Path.Circle([560, 315], setting.noteSize);
	circle.fillColor = 'red';

	logTrace('Screen is Ready.')
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

		console.log(fumen);

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
			circle.position.x = 1200 - (window.performance.now() - zeroTime) / 3 % 1300;
		}
		fps++;
	}

	setInterval(function() {
		if (currentTime != player.getCurrentTime()) {
			currentTime = player.getCurrentTime();
			var estimatedZero = window.performance.now() - currentTime * 1000;
			debugTexts[1].content = "Measured Zero: " + estimatedZero;

			estimateSamples.push(estimatedZero);
			if (estimateSamples.length > setting.zeroEstimateSamples) estimateSamples.shift();
			var estimatedSum = estimateSamples.reduce(function(previous, current) {
				return previous + current;
			});
			zeroTime = estimatedSum / estimateSamples.length;

			zerocallfps++;
		}
	}, 10);
}

function normalizeNotes() {

}

