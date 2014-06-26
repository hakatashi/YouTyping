var YouTyping = function (element, settings) {
	var youTyping = this;

	this.noteState = {
		WAITING: 0,
		HITTING: 1,
		CLEARED: 2,
		HITTINGFAILED: 3,
		FAILED: 4
	};

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

		setupPlayerDeferred.resolve();
	};

	var onPlayerStateChange = function (event) {
		switch (event.data) {
		case YT.PlayerState.ENDED:
			logTrace('Player Ended.');
			break;
		case YT.PlayerState.PLAYING:
			logTrace('Player Started.');

			// seeking is only available when playing
			if (youTyping.player.getCurrentTime() < youTyping.settings.offset) {
				youTyping.player.seekTo(youTyping.settings.offset, true);
			}
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
	var loadScoreXML = function () {
		// Initialize deferred
		loadXMLDeferred = $.Deferred();

		$.ajax({
			url: youTyping.settings.score,
			type: 'get',
			datatype: 'xml',
			timeout: 1000,
			success: function (data, textStatus, jqXHR) {
				youTyping.scoreXML = $(data).find('fumen').find('item');
				logTrace('Loaded XML File.');

				// parse XML and store into YouTyping.score
				youTyping.score = [];

				$(youTyping.scoreXML).each(function () {
					var tempItem = {
						time: parseFloat($(this).attr('time')) * 1000, // convert to millisecond
						type: $(this).attr('type')
					};

					if ($(this).attr('text')) {
						tempItem.text = tempItem.remainingText = $(this).attr('text');
					}

					if (tempItem.type === '+') {
						tempItem.state = youTyping.noteState.WAITING;
					}

					youTyping.score.push(tempItem);
				});

				youTyping.nextLyricIndex = findNextLyric(-1);

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

					loadTableDeferred.resolve();
				} catch (error) {
					logTrace('ERROR: Table File Parsing Failed: ' + error);
					loadTableDeferred.reject();
				}
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

		for (var i = noteIndex + 1; i < youTyping.score.length; i++) {
			var item = youTyping.score[i];
			if (item.type === '/') {
				nextNote = null;
				break;
			}
			if (item.type === '+') {
				nextNote = i;
				break;
			}
		}

		return nextNote;
	};

	// return next lyric
	var findNextLyric = function (itemIndex) {
		var nextLyric = null;

		for (var i = itemIndex + 1; i < youTyping.score.length; i++) {
			var item = youTyping.score[i];
			if (item.type === '*') {
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

		if (gotCurrentTime === 0) { // if playing time is zero `ZeroTime` is immediately `now`!
			youTyping.zeroTimePad = now + youTyping.correction - youTyping.settings.offset * 1000;
			youTyping.zeroTime = now + youTyping.correction - youTyping.settings.offset * 1000;
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
		youTyping.score.forEach(function (note, index) {
			// if it's note and passed
			if (note.type === '+' && note.time + youTyping.settings.failureSuspension < time) {
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
			} else if (note.type === '*' && note.time < time) {
				// update current lyric index
				if (youTyping.currentLyricIndex < index) { // null < number is true.
					youTyping.currentLyricIndex = index;
					youTyping.nextLyricIndex = findNextLyric(index);
				}
			} else if (note.type === '/' && note.time < time) { // if order stop marks
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
		} else if (note.state === youTyping.noteState.HITTING) {
			note.state = youTyping.noteState.HITTINGFAILED;
		}
	};


	/******************* properties *******************/

	this.startTime = Date.now();

	// score data
	this.scoreXML = null;
	this.score = null;

	// YouTube Iframe Player
	this.player = null;

	// default settings
	this.settings = {
		zeroEstimateSamples: 16, // integer
		videoId: 'fQ_m5VLhqNg',
		score: 'data.utfx',
		width: 1120, // pixel
		height: 630, // pixel
		hitPosition: 400, // pixel
		noteSize: 50, // pixel
		lyricSize: 20, // pixel
		speed: 0.5, // pixel per second
		scoreYpos: 0.5, // ratio
		longLineHeight: 150, // pixel
		lineHeight: 120, // pixel
		screenPadding: 30, // pixel
		bufferTextPosition: [0.2, 0.8], // ratio in screen
		currentLyricPosition: [0.5, 0.25], // ration in screen
		nextLyricPosition: [0.5, 0.3], // ration in screen
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
		failureSuspension: 100, // millisecond
		correction: 0, // millisecond
		controlledCorrection: 0, // millisecond
		offset: 0, // second
		volume: 100, // percent
		tableFile: 'convert/romaji.xml'
	};

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


	/******************* Methods *******************/

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
			var note = youTyping.score[noteIndex];
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

				// if new input buffer equals selected rule, the rule is satisfied, and then
				// rule.after are taken from remaining text.
				// this can be done by just comparing their length.
				if (newInputBuffer.length === minimumRule.before.length) {
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
			var note = youTyping.score[newNoteInfo.noteIndex];

			// update current note index
			youTyping.currentNoteIndex = newNoteInfo.noteIndex;

			if (newNoteInfo.remainingText === '') {
				note.state = youTyping.noteState.CLEARED;
				note.remainingText = '';
				youTyping.inputBuffer = '';
				youTyping.currentNoteIndex = null;
			} else {
				note.state = youTyping.noteState.HITTING;
				note.remainingText = newNoteInfo.remainingText;
				youTyping.inputBuffer = newNoteInfo.inputBuffer;
			}

			// mark all the previous note failed
			youTyping.score.forEach(function (item, index) {
				if (item.type === '+' && item.time < note.time) {
					if (item.state === youTyping.noteState.WAITING || item.state === youTyping.noteState.HITTING) {
						markFailed(item);
					}
				}
			});

			// force hit
			if (newNoteInfo.forcedHit) {
				youTyping.hit(newNoteInfo.forcedHit, time, true);
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
		youTyping.score.forEach(function (item, index) {
			if (item.type === '+') {
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
					var previousNote = youTyping.score[youTyping.currentNoteIndex];
					markFailed(previousNote);
				}

				hitNote(nearestNewNote);

				console.log(distance, hitJudge);
			}
		}
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
			}
		}
	}

	// calculate correction
	this.correction = this.settings.correction + this.settings.controlledCorrection + this.settings.offset * 1000;

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
		}),

		player: $('<div/>', {
			id: 'youtyping-player'
		}).appendTo(element).css({
			width: this.settings.width + 'px',
			height: this.settings.height + 'px',
			display: 'block',
			'z-index': 0
		}),

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
		})
	};

	// create YouTyping screen class
	this.screen = new Screen(document.getElementById('youtyping-screen'), this);

	// Initialize asynchronously
	// http://stackoverflow.com/questions/22346345/
	$.when(
		$.when(
			loadScoreXML(),
			$.Deferred(this.screen.setup).promise()
		).done(this.screen.load),
		loadTable(),
		setupPlayer()
	).done(this.screen.ready)
	.fail(function () {
		logTrace('ERROR: Initialization Failed...');
	});
};
