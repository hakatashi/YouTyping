var setting = {
	zeroEstimateSamples: 16
};

$(document).ready(function() {
	logTrace('Document is Ready.');
});

function setupPlayer() {
	setupPlayerDeferred = $.Deferred(); //grobal
	
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
		height: '630',
		width: '1120',
		videoId: 'fQ_m5VLhqNg',
		playerVars: {
			rel: 0,
			controls: 0,
			showinfo: 0,
			modestbranding: 1,
			wmode: 'opaque'
		},
		events:{
			'onReady': onPlayerReady,
			'onStateChange': onPlayerStateChange
		}
	});
}

function onPlayerReady(event) {
	logTrace("Player is Ready.");
	setupPlayerDeferred.resolve();
	setupScreen();
	event.target.playVideo();
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
