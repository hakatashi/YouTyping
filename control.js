var setting = {
	zeroEstimateSamples: 16,
	videoId: 'fQ_m5VLhqNg',
	fumen: 'data.utfx',
	width: 1120,
	height: 630,
	hitPosition: 200,
	noteSize: 50,
	speed: 500, // pixel per second
	fumenYpos: 315,
	longLineHeight: 150,
	lineHeight: 120
};

var fumenUTFX;
var fumen = [];

$(document).ready(function() {
	logTrace('Document is Ready.');
	var player = setupPlayer();
	var screen = $.Deferred(setupScreen).promise();
	var UTFX = loadUTFX();
	$.when(
		$.when(UTFX, screen).done(loadScreen),
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
	if (!getParameterByName('sandbox') || getParameterByName('sandbox') == 'true') {
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
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec(location.search);
	return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

// from http://stackoverflow.com/questions/6466135/
function pad(str, max) {
	str = str.toString();
	return str.length < max ? pad("0" + str, max) : str;
}
