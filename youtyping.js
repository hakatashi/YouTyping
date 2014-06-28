/* youtyping.js 06-28-2014 */

(function(exports){
var YouTyping = function (element, settings) {
	var youTyping = this;
	var screen = settings.screen;

	/******************* properties *******************/

	this.noteState = {
		WAITING: 0,
		HITTING: 1,
		CLEARED: 2,
		HITTINGFAILED: 3,
		FAILED: 4
	};

	// default settings
	this.settings = {
		zeroEstimateSamples: 16, // integer
		videoId: 'fQ_m5VLhqNg',
		dataFile: 'data.utx',
		tableFile: 'convert/romaji.xml',
		width: 1120, // pixel
		height: 630, // pixel
		judges: [ // millisecond
		{
			name: 'perfect',
			from: -50,
			to: 50
		},
		{
			name: 'great',
			from: -70,
			to: 70
		},
		{
			name: 'good',
			from: -100,
			to: 100
		},
		{
			name: 'bad',
			from: -Infinity,
			to: 150
		}
		],
		breakCombo: 'bad', // judgement name
		failureSuspension: 100, // millisecond
		initial: false, // boolean
		correction: 0, // millisecond
		controlledCorrection: 0, // millisecond
		offset: 0, // second
		volume: 100, // percent
		playbackQuality: 'default' // string: https://developers.google.com/youtube/iframe_api_reference#Playback_quality
	};

	this.startTime = Date.now();

	// roll data
	this.dataXML = null;
	this.roll = null;

	// YouTube Iframe Player
	this.player = null;

	// ZeroTime calculation
	this.zeroTime = 0;
	this.zeroTimePad = 0;
	this.currentTime = 0;
	this.estimateSamples = [];
	this.estimatedZero = 0; // exposed only for debugging
	this.zeroCallFPS = 0; // exposed only for debugging

	// YouTyping.now
	Object.defineProperty(this, 'now', {
		get: function () {
			// note: this is most frequently called property in YouTyping.
			// In chrome, Date.now is faster than performance.now,
			// but Firefox is not. Came from http://jsperf.com/new-date-vs-date-now-vs-performance-now/21
			return window.performance.now();
		}
	});

	// key-input conversion table
	this.table = [];

	this.currentNoteIndex = null;
	this.inputBuffer = '';

	// lyrics
	this.currentLyricIndex = null;
	this.nextLyricIndex = null; // initialized in loadXML()

	this.combo = 0;
	this.maxCombo = 0;
	this.score = 0;
	this.scorebook = {};


	/******************* Internal functions *******************/

	var setupPlayerDeferred;
	var setupPlayer = function (callback) {
		setupPlayerDeferred = $.Deferred();
		logTrace('Setting Player Up...');

		var APITag = document.createElement('script');
		APITag.src = 'https://www.youtube.com/iframe_api';
		var firstScript = document.getElementsByTagName('script')[0];
		firstScript.parentNode.insertBefore(APITag, firstScript);

		return setupPlayerDeferred.promise();
	};

	// callback function used by YouTube IFrame Player API. must be global
	window.onYouTubeIframeAPIReady = function () {
		var settings = youTyping.settings;

		logTrace('Player API is Ready.');

		// try to hide advertisement if sandbox parameter is 'true' or not defined in URI query
		if (getParameterByName('sandbox') === 'true') {
			this.DOM.player.setAttribute('sandbox', 'allow-same-origin allow-scripts');
		}

		youTyping.player = new YT.Player('youtyping-player', {
			height: settings.height,
			width: settings.width,
			videoId: settings.videoId,
			playerVars: {
				rel: 0,
				start: settings.offset,
				// Wishing the best effort of hiding any information except for the video
				controls: 0,
				showinfo: 0,
				modestbranding: 1,
				wmode: 'opaque' // thanks http://stackoverflow.com/questions/6826386/
			},
			events: {
				onReady: onPlayerReady,
				onStateChange: onPlayerStateChange,
				onError: onPlayerError
			}
		});
	};

	var onPlayerReady = function (event) {
		logTrace('Player is Ready.');

		youTyping.player.setVolume(youTyping.settings.volume);
		youTyping.player.setPlaybackQuality(youTyping.settings.playbackQuality);

		setupPlayerDeferred.resolve();
	};

	var onPlayerStateChange = function (event) {
		screen.onPlayerStateChange.call(screen, event);

		switch (event.data) {
		case YT.PlayerState.ENDED:
			logTrace('Player Ended.');
			break;
		case YT.PlayerState.PLAYING:
			logTrace('Player Started.');
			break;
		case YT.PlayerState.PAUSED:
			logTrace('Player Paused.');
			break;
		case YT.PlayerState.BUFFERING:
			logTrace('Player Buffering.');
			break;
		case YT.PlayerState.CUED:
			logTrace('Player Cued.');
			break;
		}
	};

	var onPlayerError = function (event) {
		// from https://developers.google.com/youtube/iframe_api_reference
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
	};

	var loadXMLDeferred;
	var loadDataXML = function () {
		// Initialize deferred
		loadXMLDeferred = $.Deferred();

		$.ajax({
			url: youTyping.settings.dataFile,
			type: 'get',
			datatype: 'xml',
			timeout: 1000,
			success: function (data, textStatus, jqXHR) {
				youTyping.dataXML = $(data).find('data').first();

				var items = youTyping.dataXML.find('roll > item');

				// parse XML and store into YouTyping.roll
				youTyping.roll = [];

				var lastNote = null;

				$(items).each(function () {
					var tempItem = {
						time: parseFloat($(this).attr('time')) * 1000, // convert to millisecond
						type: $(this).attr('type')
					};

					if ($(this).has('text')) {
						tempItem.text = tempItem.remainingText = $(this).children('text').text();
					}

					if (tempItem.type === 'note') {
						tempItem.state = youTyping.noteState.WAITING;
						tempItem.judgement = null;
						lastNote = tempItem;
					}

					youTyping.roll.push(tempItem);
				});

				youTyping.lastNote = lastNote;

				youTyping.nextLyricIndex = findNextLyric(-1);

				logTrace('Loaded XML File.');

				loadXMLDeferred.resolve();
			},
			error: function (jqXHR, textStatus, errorThrown) {
				logTrace('ERROR: XML File Loading Failed: ' + errorThrown);
				loadXMLDeferred.reject();
			}
		});

		return loadXMLDeferred.promise();
	};

	var loadTableDeferred;
	var loadTable = function () {
		// initialize deferred
		loadTableDeferred = $.Deferred();

		$.ajax({
			url: youTyping.settings.tableFile,
			type: 'get',
			datatype: 'xml',
			timeout: 1000,
			success: function (data, textStatus, jqXHR) {
				try {
					youTyping.table = [];

					$(data).find('table').find('rule').each(function (index) {
						youTyping.table.push({
							before: $(this).attr('before'),
							after: $(this).attr('after'),
							next: $(this).attr('next')
						});

						if ($(this).attr('next')) {
							if ($(this).attr('next').length !== 1) {
								throw 'Rule ' + index + ': next string must be one character';
							}
						}
					});

					logTrace('Loaded Table File.');
				} catch (error) {
					logTrace('ERROR: Table File Parsing Failed: ' + error);
					loadTableDeferred.reject();
					return;
				}

				loadTableDeferred.resolve();
			},
			error: function (jqXHR, textStatus, errorThrown) {
				logTrace('ERROR: Table File Loading Failed: ' + errorThrown);
				loadTableDeferred.reject();
			}
		});

		return loadTableDeferred.promise();
	};

	// return next valid note
	var findNextNote = function (noteIndex) {
		var nextNote = null;

		for (var i = noteIndex + 1; i < youTyping.roll.length; i++) {
			var item = youTyping.roll[i];
			if (item.type === 'stop') {
				nextNote = null;
				break;
			}
			if (item.type === 'note') {
				nextNote = i;
				break;
			}
		}

		return nextNote;
	};

	// return next lyric
	var findNextLyric = function (itemIndex) {
		var nextLyric = null;

		for (var i = itemIndex + 1; i < youTyping.roll.length; i++) {
			var item = youTyping.roll[i];
			if (item.type === 'lyric') {
				nextLyric = i;
				break;
			}
		}

		return nextLyric;
	};

	// game loop
	var gameLoop = function () {
		// calculate `ZeroTime`

		/***************

		# What's `ZeroTime` and `ZeroCall`?

		The current time taken from YouTube API by `getCurrentTime()`
		is resoluted very roughly (about 0.2s) with a great range of errors (about 0.05s).

		It's so fatal for music game like YouTyping. So we introduced idea that calibrates
		correct playing time by taking average of measuring. That's `ZeroTime`.

		YouTyping loops to get current playing time from API (to `gotCurrentTime`)
		with enough interval time (10ms) to detect when the `getCurrentTime()` time jumped up to another value.
		And each time `gotCurrentTime` jumped (nameed `ZeroCall`),
		YouTyping assumes the time to be correct and counts backward to estimate when this video started,
		so the time is nameed `ZeroTime`. Then the current playing time of video will be calculated by `ZeroTime` and
		current time taken from browser clock (very highly resoluted as <1ms).

		***************/

		var gotCurrentTime = youTyping.player.getCurrentTime();
		var now = youTyping.now;

		if (gotCurrentTime === youTyping.settings.offset) { // if playing time is zero `ZeroTime` is immediately `now`!
			youTyping.zeroTimePad = now - youTyping.settings.offset * 1000 + youTyping.correction;
			youTyping.zeroTime = now - youTyping.settings.offset * 1000 + youTyping.correction;
		} else if (youTyping.currentTime !== gotCurrentTime && gotCurrentTime > youTyping.settings.offset) { // if Current Time jumped
			youTyping.currentTime = gotCurrentTime;
			youTyping.estimatedZero = now - youTyping.currentTime * 1000;

			// Estimated zero time is stored in estimatesamples and
			// we assume that correct zero time is average of recent
			// `zeroEstimateSamples` items of samples
			// because it contains great ranges of error.
			// We also introduced `zeroTimePad` to supress a sudden change of zeroTime.
			// It contains correct zero time and sudden-change-supressed zero time
			// will be stored in `zeroTime`.
			youTyping.estimateSamples.push(youTyping.estimatedZero);
			if (youTyping.estimateSamples.length > youTyping.settings.zeroEstimateSamples) {
				youTyping.estimateSamples.shift();
			}
			// just go hack :)
			var estimatedSum = youTyping.estimateSamples.reduce(function (previous, current) {
				return previous + current;
			});

			// `zeroTimePad` is actual estimated ZeroTime and real displayed ZeroTime is modested into `zeroTime`.
			youTyping.zeroTimePad = estimatedSum / youTyping.estimateSamples.length + youTyping.correction;

			youTyping.zeroCallFPS++;
		}
		youTyping.zeroTime = (youTyping.zeroTime - youTyping.zeroTimePad) * 0.9 + youTyping.zeroTimePad;

		// mark past notes as failed
		var time = now - youTyping.zeroTime;
		var previousLiveNote = null;
		var previousLiveNoteIndex = null;
		youTyping.roll.forEach(function (note, index) {
			// if it's note and passed
			if (note.type === 'note' && note.time + youTyping.settings.failureSuspension < time) {
				// and if the note is live
				if (note.state === youTyping.noteState.WAITING || note.state === youTyping.noteState.HITTING) {
					// and if previous live note exists
					if (previousLiveNote) {
						// mark it failed
						markFailed(previousLiveNote);

						if (previousLiveNoteIndex === youTyping.currentNoteIndex) {
							youTyping.currentNoteIndex = null;
							youTyping.inputBuffer = '';
						}
					}

					previousLiveNote = note;
					previousLiveNoteIndex = index;
				}
			} else if (note.type === 'lyric' && note.time < time) {
				// update current lyric index
				if (youTyping.currentLyricIndex < index) { // null < number is true.
					youTyping.currentLyricIndex = index;
					youTyping.nextLyricIndex = findNextLyric(index);
				}
			} else if (note.type === 'stop' && note.time < time) { // if order stop marks
				// cancel current lyric
				if (youTyping.currentLyricIndex < index) {
					youTyping.currentLyricIndex = null;
				}
				// and if previous live note exists
				if (previousLiveNote) {
					// mark it failed
					markFailed(previousLiveNote);

					if (previousLiveNoteIndex === youTyping.currentNoteIndex) {
						youTyping.currentNoteIndex = null;
						youTyping.inputBuffer = '';
					}
				}

				previousLiveNote = null;
				previousLiveNoteIndex = null;
			}
		});
	};

	// mark as failed
	var markFailed = function (note) {
		if (note.state === youTyping.noteState.WAITING) {
			note.state = youTyping.noteState.FAILED;
			note.judgement = 'neglect';
			youTyping.scorebook.neglect++;
		} else if (note.state === youTyping.noteState.HITTING) {
			note.state = youTyping.noteState.HITTINGFAILED;
			note.judgement = 'failed';
			youTyping.scorebook.failed++;
		}

		if (youTyping.lastNote.state !== youTyping.noteState.WAITING &&
		    youTyping.lastNote.state !== youTyping.noteState.HITTING) {
			endGame();
		}

		youTyping.combo = 0;
	};

	var endGame = function () {
		screen.onGameEnd();
	};


	/******************* Exposed Methods *******************/

	this.play = function () {
		youTyping.player.playVideo();
		setInterval(gameLoop, 10);
	};

	// hit key
	// TODO: make HitEvent interface
	this.hit = function (key, time, forceHit) {
		if (!time) {
			time = youTyping.now - youTyping.zeroTime;
		}

		// check hit-ability of note by passed key.
		// return false when un-hit-able, and info about new note when hit-able
		var preHitNote = function (noteIndex, hitKey) {
			var note = youTyping.roll[noteIndex];
			var newInputBuffer = '';

			if (noteIndex === youTyping.currentNoteIndex) {
				newInputBuffer = youTyping.inputBuffer + key;
			} else { // discard input buffer if not hitting current note
				newInputBuffer = key;
			}

			if (!hitKey) {
				hitKey = key;
			}

			// TODO: Polyfill Array.prototype.filter (IE<9)
			var matchingRules = youTyping.table.filter(function (rule) {
				// currently YouTyping assumes no character in lyric cannnot be input as
				// single character. (e.g. 'きゃ' is also inputtable as 'ki lya' in romaji mode)
				// so YouTyping spares no effort to find special combination of
				// rules that can generate ramaining text, but it deserves consideration to
				// prevent evel behavior of breaking conversion table input.
				if (!startsWith(rule.before, newInputBuffer)) {
					return false;
				}
				if (!startsWith(note.remainingText, rule.after)) {
					return false;
				}

				// if rule has next character
				if (rule.next) {
					// check for hittability of next note by next character.
					var nextNoteIndex;
					if ((nextNoteIndex = findNextNote(noteIndex)) !== null) { // if next note exists
						var nextNoteInfo = preHitNote(nextNoteIndex, rule.next);

						// if next note is hittable, return true.
						if (nextNoteInfo) {
							return true;
						} else {
							return false;
						}
					} else { // if next note doesn't exist
						return false;
					}
				}

				return true;
			});

			if (matchingRules.length === 0) { // if no rule matches
				return false;
			} else { // if any rule matches
				var newNoteInfo = {
					noteIndex: noteIndex,
					forcedHit: null
				};

				// take the rule of minimum length (for some comforts)
				var minimumLength = Infinity;
				var minimumRule = null;
				matchingRules.forEach(function (rule) {
					if (rule.before.length < minimumLength) {
						minimumLength = rule.before.length;
						minimumRule = rule;
					}
				});

				newNoteInfo.appliedRule = minimumRule;

				if (youTyping.settings.initial) {
					newNoteInfo.remainingText = '';
					newNoteInfo.inputBuffer = '';
				}
				// if new input buffer equals selected rule, the rule is satisfied, and then
				// rule.after are taken from remaining text.
				// this can be done by just comparing their length.
				else if (newInputBuffer.length === minimumRule.before.length) {
					newNoteInfo.remainingText = note.remainingText.substr(minimumRule.after.length);
					newNoteInfo.inputBuffer = '';

					if (minimumRule.next) {
						// https://github.com/hakatashi/YouTyping/wiki/Forced-hit
						newNoteInfo.forcedHit = minimumRule.next;
					}
				} else {
					newNoteInfo.remainingText = note.remainingText;
					newNoteInfo.inputBuffer = newInputBuffer;
				}

				return newNoteInfo;
			}
		};

		// hit note by passed key
		var hitNote = function (newNoteInfo) {
			var note = youTyping.roll[newNoteInfo.noteIndex];

			// update current note index
			youTyping.currentNoteIndex = newNoteInfo.noteIndex;

			if (newNoteInfo.remainingText === '') {
				note.state = youTyping.noteState.CLEARED;
				note.remainingText = '';
				youTyping.inputBuffer = '';
				youTyping.currentNoteIndex = null;

				// record in scorebook
				youTyping.scorebook[note.judgement]++;
			} else {
				note.state = youTyping.noteState.HITTING;
				note.remainingText = newNoteInfo.remainingText;
				youTyping.inputBuffer = newNoteInfo.inputBuffer;
			}

			// mark all the previous note failed
			youTyping.roll.forEach(function (item, index) {
				if (item.type === 'note' && item.time < note.time) {
					if (item.state === youTyping.noteState.WAITING || item.state === youTyping.noteState.HITTING) {
						markFailed(item);
					}
				}
			});

			// force hit
			if (newNoteInfo.forcedHit) {
				youTyping.hit(newNoteInfo.forcedHit, time, true);
			}

			// if last note is cleared, let's end game
			if (youTyping.lastNote.state !== youTyping.noteState.WAITING &&
			    youTyping.lastNote.state !== youTyping.noteState.HITTING) {
				endGame();
			}
		};

		if (key.length !== 1) {
			return;
		}

		// if currently hitting some note, try to hit it to complete
		if (youTyping.currentNoteIndex !== null) {
			var newNoteInfo = preHitNote(youTyping.currentNoteIndex);

			if (newNoteInfo) { // if current note is hit-able
				hitNote(newNoteInfo);
				return;
			}
		}

		// search for nearest note that matches currently passed key rule
		var nearestNote = null;
		var nearestNewNote = null;
		var nearestDistance = Infinity;
		youTyping.roll.forEach(function (item, index) {
			if (item.type === 'note') {
				if (
					index > youTyping.currentNoteIndex && // Luckily `positive number` > null is always true :)
					item.state === youTyping.noteState.WAITING &&
					Math.abs(item.time - time) < Math.abs(nearestDistance)
				) {
					var newNoteInfo = preHitNote(index);

					if (newNoteInfo) {
						nearestNote = item;
						nearestNewNote = newNoteInfo;
						nearestDistance = item.time - time;
					}
				}
			}
		});

		var distance = nearestDistance;

		if (nearestNote !== null) {
			// timing judgement
			var hitJudge = null;

			// TODO: Polyfill Array.prototype.some (IE<9)
			youTyping.settings.judges.some(function (judge) {
				if (judge.from <= distance && distance <= judge.to) {
					hitJudge = judge.name;
					return true;
				}
				return false;
			});

			// force hit
			if (forceHit && hitJudge === null) {
				// apply the most 'baaad' judge
				hitJudge = youTyping.judges[youTyping.judges.length - 1].name;
			}

			if (hitJudge !== null) {
				// if currently hitting other note now, it will be marked as HITTINGFAILED
				if (youTyping.currentNoteIndex !== null) {
					var previousNote = youTyping.roll[youTyping.currentNoteIndex];
					markFailed(previousNote);
				}

				// update current note judgement
				nearestNote.judgement = hitJudge;

				// hit note
				hitNote(nearestNewNote);

				// breaking combo
				if (hitJudge === youTyping.settings.breakCombo) {
					youTyping.combo = 0;
				}

				youTyping.combo++;

				// update max combo
				if (youTyping.combo > youTyping.maxCombo) {
					youTyping.maxCombo = youTyping.combo;
				}

				// trigger judgement effect
				screen.onJudgement.call(screen, {
					judgement: {
						distance: distance,
						judge: hitJudge,
						combo: youTyping.combo
					}
				});
			}
		}
	};

	// get kana version of currently playing lyric
	this.getKanaLyric = function (lyricIndex) {
		if (typeof lyricIndex === 'undefined') {
			lyricIndex = youTyping.currentLyricIndex;
		}

		if (lyricIndex === null) {
			return null;
		}

		var kanaLyric = '';

		for (var i = lyricIndex + 1; i < youTyping.roll.length; i++) {
			if (youTyping.roll[i].type === 'note') {
				kanaLyric += youTyping.roll[i].text;
			} else if (
				youTyping.roll[i].type === 'stop' ||
				youTyping.roll[i].type === 'lyric'
			) {
				break;
			}
		}

		return kanaLyric;
	};


	/******************* Initialization *******************/

	// override default settings
	for (var param in settings) {
		if (settings.hasOwnProperty(param)) {
			if (this.settings[param] === undefined) {
				this.settings[param] = settings[param];
			} else if (typeof this.settings[param] === 'number') {
				this.settings[param] = parseFloat(settings[param], 10);
			} else if (typeof this.settings[param] === 'string') {
				this.settings[param] = settings[param];
			} else if (typeof this.settings[param] === 'boolean') {
				this.settings[param] = Boolean(settings[param]);
			}
		}
	}

	// calculate correction
	this.correction = this.settings.correction + this.settings.controlledCorrection + this.settings.offset * 1000;
	// initialize zeroTime
	this.zeroTimePad = this.correction - this.settings.offset * 1000;
	this.zeroTime = this.correction - this.settings.offset * 1000;

	// sanitize Screen
	var callbacks = [
	'onResourceReady',
	'onGameReady',
	'onPlayerStateChange',
	'onMiss',
	'onHit',
	'onJudgement',
	'onNoteClear',
	'onLyricChange',
	'onScoreChange',
	'onVideoEnd',
	'onGameEnd',
	'onError'
	];
	callbacks.forEach(function (callback) {
		if (typeof screen[callback] !== 'function') {
			screen[callback] = function () {};
		}
	});

	// initialize scorebook
	youTyping.scorebook.failed = 0;
	youTyping.scorebook.neglect = 0;
	this.settings.judges.forEach(function (judge) {
		youTyping.scorebook[judge.name] = 0;
	});

	// Initialize asynchronously
	// http://stackoverflow.com/questions/22346345/
	$.when(
		$.when(
			loadDataXML(),
			loadTable()
		).done(screen.onResourceReady),
		setupPlayer()
	).done(screen.onGameReady)
	.fail(function () {
		logTrace('ERROR: Initialization Failed...');
	});
};


// Class Screen defines canvas part of YouTyping.
// One YouTyping have only one Screen as child, and vice versa.
var Screen = function (element, settings) {
	var screen = this;

	var FPS = 0;

	// All notes and lines will be stored in this variable and managed
	// in key which represents index.
	this.items = {};

	// default screen settings
	this.settings = {
		width: 1120, // pixel
		height: 630, // pixel
		hitPosition: 0.4, // ratio
		speed: 0.5, // pixel per second
		noteSize: 50, // pixel
		lyricSize: 20, // pixel
		rollYpos: 0.5, // ratio
		longLineHeight: 150, // pixel
		lineHeight: 120, // pixel
		screenPadding: 30, // pixel
		bufferTextPosition: [0.2, 0.8], // ratio in screen
		currentLyricPosition: [0.5, 0.25], // ratio in screen
		nextLyricPosition: [0.5, 0.3], // ratio in screen
		kanaLyricPosition: [0.5, 0.8], // ratio in screen
		judgeColors: {
			perfect: 'yellow',
			great: '#2d1',
			good: '#19a',
			bad: '#aaa',
			failed: '#a34',
			neglect: '#39a'
		}
	};

	// default YouTyping setting
	var youTypingSettings = {
		videoId: 'fQ_m5VLhqNg',
		dataFile: 'data.utx',
		tableFile: 'convert/romaji.xml',
		initial: false, // boolean
		correction: 0, // millisecond
		controlledCorrection: 0, // millisecond
		offset: 0, // second
		volume: 100, // percent
		playbackQuality: 'default',
		screen: screen
	};

	this.initialize = function () {
		paper.setup(screen.canvas);

		screen.cover = new paper.Path.Rectangle(paper.view.bounds);
		screen.cover.fillColor = 'black';
		screen.cover.fillColor.alpha = 0.7;

		screen.debugTexts = [];
		for (var i = 0; i < 5; i++) {
			var index = screen.debugTexts.push(new paper.PointText([20, 20 * (i + 1)]));
			screen.debugText = screen.debugTexts[index - 1];
			screen.debugText.justification = 'left';
			screen.debugText.fillColor = 'white';
		}

		screen.bufferText = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.bufferTextPosition),
			content: '',
			fillColor: 'white',
			justification: 'left',
			fontSize: 24
		});

		screen.currentLyric = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.currentLyricPosition),
			content: '',
			fillColor: 'white',
			justification: 'center',
			fontSize: 36
		});

		screen.nextLyric = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.nextLyricPosition),
			content: '',
			fillColor: 'white',
			justification: 'center',
			fontSize: 18
		});

		screen.kanaLyric = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply(settings.kanaLyricPosition),
			content: '',
			fillColor: 'white',
			justification: 'center',
			fontSize: 24
		});

		screen.judgeEffects = new paper.Group();

		setInterval(function () {
			screen.debugTexts[0].content = 'FPS: ' + FPS;
			FPS = 0;
			screen.debugTexts[2].content = 'Zerocall FPS: ' + youTyping.zeroCallFPS;
			youTyping.zeroCallFPS = 0; // not good
		}, 1000);

		logTrace('Screen Initialized.');
	};

	this.onResourceReady = function () {
		var now = youTyping.now;

		var paddingRight = settings.width * (1 - settings.hitPosition) + settings.noteSize + settings.screenPadding; // distance from hit line to right edge
		var paddingLeft = settings.width * settings.hitPosition + settings.noteSize + settings.screenPadding; // distance from hit line to left edge

		try {
			// Computes emerge time and vanishing time of item.
			// This is yet a very simple way without regards for speed changes.
			youTyping.roll.forEach(function (item, index) {
				item.emergeTime = (settings.speed * item.time - paddingRight) / settings.speed;
				item.vanishTime = (settings.speed * item.time + paddingLeft) / settings.speed;
			});

			logTrace('Computed roll Parameters.');
		} catch (error) {
			logTrace('ERROR: Computing roll Parameters Faild: ' + error);
			return -1;
		}

		youTyping.zeroTime = now;
		screen.update();

		screen.hitCircle = new paper.Path.Circle({
			center: paper.view.bounds.bottomRight.multiply([settings.hitPosition, settings.rollYpos]),
			radius: settings.noteSize,
			strokeWidth: 1,
			strokeColor: 'white'
		});
	};

	this.onGameReady = function () {
		screen.pressEnter = new paper.PointText({
			point: paper.view.bounds.bottomRight.multiply([0.5, 0.8]),
			content: 'Press enter or click here.',
			justification: 'center',
			fontSize: 45,
			fillColor: 'white'
		});
		var triggerStartScreen = function (event) {
			if ((event.type === 'keydown' && event.key === 'enter') || event.type === 'mousedown') {
				screen.pressEnter.remove();
				paper.tool.onKeyDown = null; // unbind
				screen.start();
			}
		};
		paper.tool.onKeyDown = triggerStartScreen;
		screen.pressEnter.onMouseDown = triggerStartScreen;

		logTrace('Game is Ready.');
	};

	this.start = function () {
		logTrace('Starting game.');

		// register onFrame event
		paper.view.onFrame = screen.onFrame;

		youTyping.play();

		var triggerHitNote = function (event) {
			if (youTyping.player.getPlayerState() === 1 && event.type === 'keydown') {
				// suspend default operation on browser by keydown
				event.preventDefault();
				youTyping.hit(event.key);
			}
		};
		paper.tool.onKeyDown = triggerHitNote;
	};

	// layout notes and lines fitting to current time
	this.update = function () {
		var items = screen.items;

		var now = youTyping.now;
		var runTime = now - youTyping.zeroTime;

		youTyping.roll.forEach(function (item, index) {
			// X position of the item
			var position = (item.time - runTime) * settings.speed + settings.width * settings.hitPosition;

			// if index-th item doesn't exists in screen
			if (!(index in items)) {
				if (item.emergeTime <= runTime && runTime <= item.vanishTime) {
					// create item
					items[index] = new paper.Group();

					// long line which devides roll to measures
					if (item.type === 'longline') {
						items[index].longLine = items[index].addChild(new paper.Path.Line({
							from: [position, settings.rollYpos * settings.height - settings.longLineHeight / 2],
							to: [position, settings.rollYpos * settings.height + settings.longLineHeight / 2],
							strokeColor: 'white',
							strokeWidth: 2
						}));
					}
					// small line
					if (item.type === 'line') {
						items[index].smallLine = items[index].addChild(new paper.Path.Line({
							from: [position, settings.rollYpos * settings.height - settings.lineHeight / 2],
							to: [position, settings.rollYpos * settings.height + settings.lineHeight / 2],
							strokeColor: 'white',
							strokeWidth: 1
						}));
					}
					if (item.type === 'note') {
						// note
						items[index].note = items[index].addChild(new paper.Path.Circle({
							center: [position, settings.rollYpos * settings.height],
							radius: settings.noteSize,
							strokeWidth: 1,
							strokeColor: '#aaa'
						}));
						// lyric
						items[index].lyric = items[index].addChild(new paper.PointText({
							point: [position, settings.rollYpos * settings.height + settings.noteSize + 50],
							content: item.remainingText,
							fillColor: 'white',
							justification: 'center',
							fontSize: settings.lyricSize,
							fontFamily: 'sans-serif'
						}));
					}
					// order stop mark
					if (item.type === 'stop') {
						items[index].orderStop = items[index].addChild(new paper.Path({
							segments: [[position, settings.rollYpos * settings.height - settings.noteSize - 30]],
							fillColor: 'white'
						}));
						items[index].orderStop.lineBy([10, -10]);
						items[index].orderStop.lineBy([-20, 0]);
						items[index].orderStop.closed = true;
					}
				} else {
					return;
				}
			} else { // if index-th item exists in screen
				if (runTime < item.emergeTime || item.vanishTime < runTime) {
					items[index].remove();
					delete items[index];
					return;
				}
			}

			// update item style
			if (item.type === 'longline') {
				items[index].position.x = position;
			}
			if (item.type === 'line') {
				items[index].position.x = position;
			}
			if (item.type === 'stop') {
				items[index].position.x = position;
			}
			if (item.type === 'note') {
				items[index].position.x = position;
				if (item.state === youTyping.noteState.CLEARED) {
					items[index].note.visible = false;
					items[index].lyric.visible = false;
				} else {
					// note
					items[index].note.style = {
						fillColor: (
							item.state === youTyping.noteState.WAITING ||
							item.state === youTyping.noteState.HITTING
						) ? 'red' : '#aaa'
					};
					items[index].note.opacity = (
						item.state === youTyping.noteState.FAILED ||
						item.state === youTyping.noteState.WAITING
					) ? 1 : 0.5;
					// lyric
					items[index].lyric.content = item.remainingText;
				}
			}
		});
	};

	this.onFrame = function (event) {
		var kanaLyric;

		if (youTyping.player.getPlayerState() === 1) {
			screen.update();
		}

		screen.debugTexts[1].content = 'Measured Zero: ' + youTyping.estimatedZero.toFixed(2);
		screen.debugTexts[3].content = 'Active Objects: ' + paper.project.activeLayer.children.length;
		screen.debugTexts[4].content = 'Zero Time: ' + youTyping.zeroTime.toFixed(2);
		screen.bufferText.content = youTyping.inputBuffer;
		screen.currentLyric.content = youTyping.currentLyricIndex ? youTyping.roll[youTyping.currentLyricIndex].text : '';
		screen.nextLyric.content = youTyping.nextLyricIndex ? youTyping.roll[youTyping.nextLyricIndex].text : '';
		// screen.kanaLyric.content = (kanaLyric = youTyping.getKanaLyric()) ? kanaLyric : '';

		screen.judgeEffects.children.forEach(function (judgeEffect) {
			judgeEffect.controller.onFrame();
		});

		FPS++;
	};

	// YouTube onStateChange event supplied from YouTyping
	this.onPlayerStateChange = function (event) {
		// hide mouse cursor when playing
		if (event.data === YT.PlayerState.PLAYING) {
			$(screen.DOM.screen).css({
				cursor: 'none'
			});
		} else {
			$(screen.DOM.screen).css({
				cursor: 'auto'
			});
		}
	};

	this.onJudgement = function (event) {
		var judgeEffect = new JudgeEffect(event.judgement);
		judgeEffect.item.controller = judgeEffect;
		screen.judgeEffects.addChild(judgeEffect.item);
	};

	// judge effect object
	var JudgeEffect = function (judgement) {
		var judgeEffect = this;

		this.item = new paper.Group();

		this.judgeColor = settings.judgeColors[judgement.judge];

		this.judge = this.item.addChild(new paper.PointText({
			point: screen.hitCircle.position.add([0, -settings.noteSize - 24]),
			content: judgement.judge,
			fillColor: this.judgeColor,
			justification: 'center',
			fontSize: 24,
			fontFamily: 'sans-serif'
		}));

		this.combo = this.item.addChild(new paper.PointText({
			point: screen.hitCircle.position.add([0, -settings.noteSize]),
			content: judgement.combo,
			fillColor: 'white',
			justification: 'center',
			fontSize: 15,
			fontFamily: 'sans-serif'
		}));

		this.onFrame = function (event) {
			this.item.translate([0, -3]);
			this.item.opacity -= 0.02;

			if (this.item.opacity < 0) {
				this.item.remove();
			}
		};
	};

	this.onGameEnd = function () {
		logTrace('Game Ended.');

		screen.resultCover = new paper.Path.Rectangle(paper.view.bounds);
		screen.resultCover.fillColor = '#ddd';
		screen.resultCover.fillColor.alpha = 0;

		screen.resultCover.onFrame = function (event) {
			this.fillColor.alpha += 0.01;
			if (this.fillColor.alpha >= 1) {
				screen.resultCover.onFrame = null;
				showResult();
			}
		};
	};

	var showResult = function () {
		var screenSize = paper.view.bounds.bottomRight;

		screen.result = [];

		screen.result.push(new paper.PointText({
			point: screenSize.multiply([0.2, 0]).add([0, 100]),
			content: 'Result:',
			fillColor: 'black',
			justification: 'left',
			fontSize: 48,
			fontFamily: 'sans-serif'
		}));

		['perfect', 'great', 'good', 'bad', 'failed', 'neglect'].forEach(function (judgement, index) {
			var color = new paper.Color(settings.judgeColors[judgement]);
			color.brightness -= 0.3;
			color.saturation += 0.2;
			screen.result.push(new paper.PointText({
				point: screenSize.multiply([0.2, 0]).add([0, 40 * index + 180]),
				content: judgement + ': ' + youTyping.scorebook[judgement],
				fillColor: color,
				justification: 'left',
				fontSize: 36,
				fontFamily: 'sans-serif'
			}));
		});

		screen.result.push(new paper.PointText({
			point: screenSize.multiply([0.2, 0]).add([0, 450]),
			content: 'Max Combo: ' + youTyping.maxCombo,
			fillColor: 'black',
			justification: 'left',
			fontSize: 36,
			fontFamily: 'sans-serif'
		}));
	};

	// Initialization

	// override default screen settings
	for (var param in settings) {
		if (settings.hasOwnProperty(param)) {
			if (this.settings[param] === undefined) {
				this.settings[param] = settings[param];
			} else if (typeof this.settings[param] === 'number') {
				this.settings[param] = parseFloat(settings[param], 10);
			} else if (typeof this.settings[param] === 'string') {
				this.settings[param] = settings[param];
			} else if (typeof this.settings[param] === 'boolean') {
				this.settings[param] = Boolean(settings[param]);
			}
		}
	}

	// override default YouTyping settings
	for (param in youTypingSettings) {
		if (youTypingSettings.hasOwnProperty(param)) {
			if (typeof this.settings[param] !== 'undefined') {
				youTypingSettings[param] = this.settings[param];
			}
		}
	}

	// shorthand
	settings = this.settings;

	// setup DOM
	/*
	* div(this.DOM.wrap)
	* |-div#youtyping-player(this.DOM.player)
	* \-canvas#youtyping-screen(this.DOM.screen)
	*/
	this.DOM = {
		wrap: element.css({
			width: this.settings.width + 'px',
			height: this.settings.height + 'px',
			margin: '0 auto',
			position: 'relative'
		})[0],

		player: $('<div/>', {
			id: 'youtyping-player'
		}).appendTo(element).css({
			width: this.settings.width + 'px',
			height: this.settings.height + 'px',
			display: 'block',
			'z-index': 0
		})[0],

		screen: $('<canvas/>', {
			id: 'youtyping-screen',
			'data-paper-keepalive': 'true',
			width: this.settings.width.toString(),
			height: this.settings.height.toString()
		}).appendTo(element).css({
			width: this.settings.width + 'px',
			height: this.settings.height + 'px',
			position: 'absolute',
			top: 0,
			left: 0,
			'z-index': 100
		})[0]
	};

	this.canvas = this.DOM.screen;

	youTypingSettings.width = this.settings.width;
	youTypingSettings.height = this.settings.height;

	this.youTyping = new YouTyping(this.DOM.player, youTypingSettings);
	var youTyping = this.youTyping; // just a shorthand

	this.initialize();
};


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


exports.YouTyping = YouTyping;
exports.Screen = Screen;
}(typeof window === 'undefined' ? module.exports : window));