var zeroTime = 0;
var currentTime = 0;
var estimateSamples = new Array();

var fps = 0;
var zerocallfps = 0;

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
	}, 1000)

	logTrace('Screen is Set.')
	deferred.resolve();
}

var loadScreen = function() {
	circle = new paper.Path.Circle([560, 315], 50);
	circle.fillColor = 'red';

	zeroLine = new paper.Path.Line([0, 250], [0, 380]);
	zeroLine.strokeColor = 'blue';

	estimatedLine = new paper.Path.Line([0, 250], [0, 380]);
	estimatedLine.strokeColor = 'white';

	logTrace('Screen is Ready.')
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
			estimatedLine.position.x = estimatedZero / 10;
			debugTexts[1].content = "Measured Zero: " + estimatedZero;

			estimateSamples.push(estimatedZero);
			if (estimateSamples.length > setting.zeroEstimateSamples) estimateSamples.shift();
			var estimatedSum = estimateSamples.reduce(function(previous, current) {
				return previous + current;
			});
			zeroTime = estimatedSum / estimateSamples.length;

			zerocallfps++;
		}
		zeroLine.position.x = zeroTime / 10;
	}, 10);
}

