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
	name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
	var regex = new RegExp('[\\?&]' + name + '=([^&#]*)'),
		results = regex.exec(location.search);
	return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
}

// from http://stackoverflow.com/questions/6466135/
function pad(str, max) {
	str = str.toString();
	return str.length < max ? pad('0' + str, max) : str;
}

// polyfill performance.now()
if (typeof window.performance === 'undefined') {
	window.performance = {};
}
if (!window.performance.now){
	var offset = Date.now();
	window.performance.now = function now(){
		return Date.now() - offset;
	};
}

// check if a string starts with specific prefix
var startsWith = function (string, prefix) {
	if (string.length < prefix.length) {
		return false;
	}
	return string.substring(0, prefix.length) === prefix;
};

// generate (hopefully unique) identifier
var generateID = function () {
	var id = '';
	for (var i = 0; i < 12; i++) {
		id += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)];
	}
	return id;
};
