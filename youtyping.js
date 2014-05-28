var startTime = Date.now();

var setting = {
	zeroEstimateSamples: 16, // integer
	videoId: 'fQ_m5VLhqNg',
	fumen: 'data.utfx',
	width: 1120, // pixel
	height: 630, // pixel
	hitPosition: 200, // pixel
	noteSize: 50, // pixel
	speed: 500, // pixel per second
	fumenYpos: 0.5, // ratio
	longLineHeight: 150, // pixel
	lineHeight: 120, // pixel
	screenPadding: 30 // pixel
};

for (var param in setting) {
	if (getParameterByName(param)) {
		if (typeof setting[param] == 'number') {
			setting[param] = parseInt(getParameterByName(param));
		} else {
			setting[param] = getParameterByName(param);
		}
	}
}

var fumenUTFX;
var fumen = [];

$.ajax('./don.svg').done(function (data) {
	don = new paper.Symbol(paper.project.importSVG(data));
});

$(document).ready(function() {
    logTrace('Document is Ready.');

    $('div#wrapper, #player, canvas#screen').css({
        width: setting.width + 'px',
        height: setting.height + 'px'
    });

	var player = setupPlayer();
	var UTFX = loadUTFX();
	var screen = $.Deferred(setupScreen).promise();
	$.when(
		$.when(
            UTFX,
            screen
        ).done(loadScreen),
		player
	).done(startScreen)
	.fail(function() {
		logTrace('ERROR: Initialization Failed...');
	});
});

function setupPlayer(callback) {
	setupPlayerDeferred = $.Deferred(); //grobal
	logTrace('Setting Player Up...');
	
	var APITag = document.createElement('script');
	APITag.src = 'https://www.youtube.com/iframe_api';
	var firstScript = document.getElementsByTagName('script')[0];
	firstScript.parentNode.insertBefore(APITag, firstScript);

	return setupPlayerDeferred.promise();
}

var player;
function onYouTubeIframeAPIReady() {
	logTrace("Player API is Ready.");

	// try to hide advertisement if sandbox parameter is 'true' or not defined in URI query
	if (getParameterByName('sandbox') == 'true') {
		document.getElementById('player').setAttribute('sandbox', 'allow-same-origin allow-scripts');
	}

	player = new YT.Player('player', {
		height: setting.height,
		width: setting.width,
		videoId: setting.videoId,
		playerVars: {
			rel: 0,
			controls: 0,
			showinfo: 0,
			modestbranding: 1,
			wmode: 'opaque'
		},
		events:{
			'onReady': onPlayerReady,
			'onStateChange': onPlayerStateChange,
			'onError': onPlayerError
		}
	});
}

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

function loadUTFX() {
	loadUTFXDeferred = $.Deferred(); //global

	$.ajax({
		url: setting.fumen,
		type: 'get',
		datatype: 'xml',
		timeout: 1000,
		success: function(data, textStatus, jqXHR) {
			fumenUTFX = $(data).find('fumen').find('item');
			logTrace('Loaded UTFX File.');
			loadUTFXDeferred.resolve();
		},
		error: function(jqXHR, textStatus, errorThrown) {
			logTrace('ERROR: UTFX File Loading Failed: ' + errorThrown);
			loadUTFXDeferred.reject();
		}
	});

	return loadUTFXDeferred.promise();
}
// All notes and lines will be stored in this variable and managed
// in key which represents index.
var items = {};

var Screen = function (canvas) {
    var zeroTime = 0;
    var zeroTimePad = 0;
    var currentTime = 0;
    var estimateSamples = [];

    var fps = 0;
    var zerocallfps = 0;

    this.setup = function (deferred) {
        this.canvas = canvas;
        paper.setup(this.canvas);

        this.cover = new paper.Path.Rectangle(paper.view.bounds);
        this.cover.fillColor = 'black';
        this.cover.fillColor.alpha = 0.7;

        this.debugTexts = [];
        for (var i = 0; i < 5; i++) {
            var index = this.debugTexts.push(new paper.PointText([20, 20 * (i + 1)]));
            this.debugText = debugTexts[index - 1];
            this.debugText.justification = 'left';
            this.debugText.fillColor = 'white';
        }

        setInterval(function () {
            this.debugTexts[0].content = "FPS: " + fps;
            fps = 0;
            this.debugTexts[2].content = "Zerocall FPS: " + zerocallfps;
            zerocallfps = 0;
        }, 1000);

        logTrace('Screen is Set.');
        deferred.resolve();
    };

    this.load = function () {
        this.computeParameters();

        updateScreen();

        hitCircle = new paper.Path.Circle({
            center: [setting.hitPosition, setting.fumenYpos * setting.height],
            radius: setting.noteSize,
            strokeWidth: 1,
            strokeColor: 'white'
        });

        logTrace('Screen is Ready.');
    };

    // Parse UTFX into fumen Object and computes various parameters like the time when the note emerges and vanishes.
    function computeParameters() {
        var paddingRight = setting.width - setting.hitPosition + setting.noteSize + setting.screenPadding; // distance from hit line to right edge
        var paddingLeft = setting.hitPosition + setting.noteSize + setting.screenPadding; // distance from hit line to left edge

        try {
            $(fumenUTFX).each(function () {
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
            fumen.forEach(function (item, index) {
                item.emergeTime = (setting.speed * item.time - paddingRight) / setting.speed;
                item.vanishTime = (setting.speed * item.time + paddingLeft) / setting.speed;
            });

            logTrace('Computed Fumen Parameters.');
        } catch (error) {
            logTrace('ERROR: Computing Fumen Parameters Faild: ' + error);
            loadUTFXDeferred.reject();
        }
    }

    var startScreen = function () {
        player.playVideo();

        paper.view.onFrame = function (event) {
            if (player.getPlayerState() == 1) {
                updateScreen();
            }
            debugTexts[3].content = "Active Objects: " + paper.project.activeLayer.children.length;
            debugTexts[4].content = 'Zero Time: ' + zeroTime.toFixed(2);
            fps++;
        };

        setInterval(function () {
            if (currentTime != player.getCurrentTime()) {
                var now = window.performance.now() || (Date.now() - startTime);

                currentTime = player.getCurrentTime();
                runTime = currentTime;
                var estimatedZero = now - currentTime * 1000;
                debugTexts[1].content = "Measured Zero: " + estimatedZero.toFixed(2);

                // Estimated zero time is stored in estimatesamples and
                // we assume that correct zero time is recent `zeroEstimateSamples` samples
                // because it contains great ranges of error.
                // We also introduced `zeroTimePad` to supress a sudden change of zeroTime.
                // It contains correct zero time and sudden-change-supressed zero time
                // will be stored in `zeroTime`.
                estimateSamples.push(estimatedZero);
                if (estimateSamples.length > setting.zeroEstimateSamples) estimateSamples.shift();
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
    function updateScreen() {
        var now = window.performance.now() || (Date.now() - startTime);
        var runTime = (now - zeroTime) / 1000;

        fumen.forEach(function (item, index) {
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
                    items[index] = new paper.Group();

                    if (item.type == '=') {
                        items[index].addChild(new paper.Path.Line({
                            from: [Xpos, setting.fumenYpos * setting.height - setting.longLineHeight / 2],
                            to: [Xpos, setting.fumenYpos * setting.height + setting.longLineHeight / 2],
                            strokeColor: 'white',
                            strokeWidth: 2
                        }));
                    }
                    if (item.type == '-') {
                        items[index].addChild(new paper.Path.Line({
                            from: [Xpos, setting.fumenYpos * setting.height - setting.lineHeight / 2],
                            to: [Xpos, setting.fumenYpos * setting.height + setting.lineHeight / 2],
                            strokeColor: 'white',
                            strokeWidth: 1
                        }));
                    }
                    if (item.type == '+') {
                        // note
                        items[index].addChild(don.place([Xpos, setting.fumenYpos * setting.height]).scale(setting.noteSize / 50 * 2));
                        // lyric
                        items[index].addChild(new paper.PointText({
                            position: [Xpos, setting.fumenYpos * setting.height + setting.noteSize + 50],
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
    }

};function logTrace(text) {
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