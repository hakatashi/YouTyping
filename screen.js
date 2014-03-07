loadScreen = function() {
	var screen = document.getElementById('screen');
	paper.setup(screen);

	var cover = new paper.Path.Rectangle([0, 0], [1120, 630]);
	cover.fillColor = 'black';
	cover.fillColor.alpha = 0.7;

	var circle = new paper.Path.Circle([560, 315], 50);
	circle.fillColor = 'red';

	var zeroLine = new paper.Path.Line([0, 250], [0, 380]);
	zeroLine.strokeColor = 'blue';

	var estimatedLine = new paper.Path.Line([0, 250], [0, 380]);
	estimatedLine.strokeColor = 'white';

	var debugText = [];
	debugText[0] = new paper.PointText([30, 30]);
	debugText[0].justification = 'left';
	debugText[0].fillColor = 'white';
	debugText[1] = new paper.PointText([30, 60]);
	debugText[1].justification = 'left';
	debugText[1].fillColor = 'white';
	debugText[2] = new paper.PointText([30, 90]);
	debugText[2].justification = 'left';
	debugText[2].fillColor = 'white';

	var zeroTime = 0;
	var currentTime = 0;
	var estimatedSum = 0;
	var estimatedPoints = 0;

	var fps = 0;
	var zerocallfps = 0;

	paper.view.onFrame = function(event) {
		if (player.getPlayerState() == 1) circle.position.x = 1200 - (window.performance.now() - zeroTime) / 3 % 1300;
		fps++;
	}

	setInterval(function() {
		debugText[0].content = "FPS: " + fps;
		fps = 0;
		debugText[2].content = "Zerocall FPS: " + zerocallfps;
		zerocallfps = 0;
	}, 1000)

	setInterval(function() {
		if (currentTime != player.getCurrentTime()) {
			var estimatedZero = window.performance.now() - player.getCurrentTime() * 1000;
			estimatedLine.position.x = estimatedZero / 10;
			currentTime = player.getCurrentTime();
			estimatedSum += estimatedZero;
			estimatedPoints++;
			zeroTime = estimatedSum / estimatedPoints;
			debugText[1].content = "Measured Zero: " + estimatedZero;
			zerocallfps++;
		}
		zeroLine.position.x = zeroTime / 10;
	}, 100);
}
