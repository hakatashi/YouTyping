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
