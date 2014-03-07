var APITag = document.createElement('script');
APITag.src = 'https://www.youtube.com/iframe_api';
var firstScript = document.getElementsByTagName('script')[0];
firstScript.parentNode.insertBefore(APITag, firstScript);

var player;
function onYouTubeIframeAPIReady() {
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
	$('#debug').html($('#debug').html() + "<br>" + "Youtube Player API is Ready.");
	// try to hide advertisement
	if (!getParameterByName('adfree')) document.getElementById('player').setAttribute('sandbox', 'allow-same-origin allow-scripts');
}

function onPlayerReady(event) {
	$('#debug').html($('#debug').html() + "<br>" + "Player is Ready.");
	loadScreen();
	event.target.playVideo();
}

var done = false;
function onPlayerStateChange(event) {
	if (event.data == YT.PlayerState.PLAYING && !done) {
		done = true;
		$('#debug').html($('#debug').html() + "<br>" + "Player Started.");
	}
}

// from http://stackoverflow.com/questions/901115/
function getParameterByName(name) {
	name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
	var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
		results = regex.exec(location.search);
	return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}
