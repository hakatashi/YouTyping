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

	this.itemType = {
		LINE: 0,
		LONGLINE: 1,
		NOTE: 2,
		LYRIC: 3,
		STOP: 4
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
			to: 50,
			weight: 1.0
		},
		{
			name: 'great',
			from: -70,
			to: 70,
			weight: 0.5
		},
		{
			name: 'good',
			from: -100,
			to: 100,
			weight: 0.25
		},
		{
			name: 'bad',
			from: -Infinity,
			to: 150,
			weight: 0.0
		}
		],
		breakCombo: 'bad', // judgement name
		failureSuspension: 100, // millisecond
		initial: false, // boolean
		mercy: true, // boolean
		mercyBorder: 13.5, // stroke per second
		correction: 0, // millisecond
		controlledCorrection: 0, // millisecond
		offset: 0, // second
		videoStop: 0, // second
		volume: 100, // percent
		playbackQuality: 'default' // string
	};

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

	// roll data
	this.dataXML = null;
	this.roll = null;

	// YouTube Iframe Player
	this.player = null;

	// YouTyping.now
	Object.defineProperty(this, 'now', {
		get: function () {
			// note: this is most frequently called property in YouTyping.
			// In chrome, Date.now is faster than performance.now,
			// but Firefox is not.
			// Came from http://jsperf.com/new-date-vs-date-now-vs-performance-now/21
			return window.performance.now();
		}
	});

	// key-input conversion table
	this.table = [];


	/******************* Internal variables *******************/

	var gameEndFlag = false;


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
				// thanks http://stackoverflow.com/questions/6826386/
				wmode: 'opaque'
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
		// play and immediately pause video to make playerState unstarted or paused.
		// this is required to make video seekable even in inactive.
		youTyping.player.playVideo();
		youTyping.player.pauseVideo();

		setupPlayerDeferred.resolve();
	};

	var onPlayerStateChange = function (event) {
		youTyping.dispatchEvent('playerstatechange', event);

		switch (event.data) {
		case YT.PlayerState.ENDED:
			logTrace('Player Ended.');
			break;
		case YT.PlayerState.PLAYING:
			logTrace('Player Started.');
			// reset zero time samples
			if (youTyping.isPlayingGame) {
				youTyping.estimateSamples = [];
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
			logTrace(
'ERROR: The request contains an invalid parameter value.\
 For example, this error occurs if you specify a video ID that does not have 11 characters,\
 or if the video ID contains invalid characters,\
 such as exclamation points or asterisks.');
			break;
		case 5:
			logTrace(
'ERROR: The requested content cannot be played in an HTML5 player\
 or another error related to the HTML5 player has occurred.');
			break;
		case 100:
			logTrace(
'ERROR: The video requested was not found.\
 This error occurs when a video has been removed (for any reason)\
 or has been marked as private.');
			break;
		case 101:
			logTrace(
'ERROR: The owner of the requested video does not allow it\
 to be played in embedded players.');
			break;
		case 150:
			logTrace(
'ERROR: The owner of the requested video does not allow it\
 to be played in embedded players.');
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
			timeout: 10000,
			success: function (data, textStatus, jqXHR) {
				youTyping.dataXML = $(data).find('data').first();

				initializeRoll();

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

	// initialize roll data for when loading and resetting
	var initializeRoll = function () {
		var items = youTyping.dataXML.find('roll > item');

		// parse XML and store into YouTyping.roll
		youTyping.roll = [];

		var lastNote = null;
		var virtualCombo = 0;
		var previousNote = null;

		$(items).each(function () {
			var tempItem = {
				// convert to millisecond
				time: parseFloat($(this).attr('time')) * 1000,
				type: $(this).attr('type').mapsTo({
					line: youTyping.itemType.LINE,
					longline: youTyping.itemType.LONGLINE,
					note: youTyping.itemType.NOTE,
					lyric: youTyping.itemType.LYRIC,
					stop: youTyping.itemType.STOP
				}),
				romaji: '',
				remainingRomaji: '',
				receivedRomaji: ''
			};

			if (tempItem.type === null) {
				logTrace('ERROR: Unknown item type ' + $(this).attr('type'));
				loadXMLDeferred.reject();
				return;
			}

			if ($(this).has('text')) {
				         tempItem.text =
				tempItem.remainingText = $(this).children('text').text();
			}

			// calculate time to the next note
			if (previousNote !== null && (
					tempItem.type === youTyping.itemType.NOTE
					|| tempItem.type === youTyping.itemType.STOP
				)
			) {
				previousNote.duration = tempItem.time - previousNote.time;
			}

			if (tempItem.type === youTyping.itemType.NOTE) {
				tempItem.state = youTyping.noteState.WAITING;
				tempItem.judgement = null;
				lastNote = tempItem;

				if (virtualCombo < 50) {
					virtualCombo++;
				}

				youTyping.totalCombo += virtualCombo;

				previousNote = tempItem;
			}

			if (tempItem.type === youTyping.itemType.STOP) {
				previousNote = null;
			}

			youTyping.roll.push(tempItem);
		});

		youTyping.lastNote = lastNote;

		youTyping.nextLyricIndex = findNextLyric(-1);
	};

	var loadTableDeferred;
	var loadTable = function () {
		// initialize deferred
		loadTableDeferred = $.Deferred();

		$.ajax({
			url: youTyping.settings.tableFile,
			type: 'get',
			datatype: 'xml',
			timeout: 10000,
			success: function (data, textStatus, jqXHR) {
				try {
					youTyping.table = [];

					$(data).find('table').find('rule').each(function (index) {
						youTyping.table.push({
							before: $(this).attr('before'),
							after: $(this).attr('after'),
							next: $(this).attr('next') || '',
							priority: $(this).attr('priority') || 0,
							strokePerCharacter:
								$(this).attr('next') ?
								($(this).attr('before').length - 1) / $(this).attr('after').length :
								$(this).attr('before').length / $(this).attr('after').length
						});

						if ($(this).attr('next')) {
							if ($(this).attr('next').length !== 1) {
								throw 'Rule ' + index + ': next string must be one character';
							}
						}
					});

					// romanization prefers rules by following priorities order:
					// 1. priority is high
					// 2. 'after' string is long
					// 3. strokes per character is short

					// table clone and sort
					youTyping.romanizationTable = $.extend(true, [], youTyping.table);
					youTyping.romanizationTable.sort(function (a, b) {
						if (a.priority !== b.priority) {
							return b.priority - a.priority;
						} else if (a.after.length !== b.after.length) {
							return b.after.length - a.after.length;
						} else if (a.strokePerCharacter !== b.strokePerCharacter) {
							return a.strokePerCharacter - b.strokePerCharacter;
						} else {
							return 0;
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

	// evaluate weight of each notes and compute scores of each notes
	var calculateWeight = function () {
		var firstNote = true;
		var totalWeight = 0;
		youTyping.roll.forEach(function (item, index) {
			// romanize
			if (item.type === youTyping.itemType.LYRIC) {
				firstNote = true;
			} else if (item.type === youTyping.itemType.NOTE && firstNote) {
				var result = romanizeNotes(index, item.text, '');

				if (result === false) {
					throw new Error('Note ' + item.text + ' cannot be romanized');
				}

				firstNote = false;
			}

			if (item.type === youTyping.itemType.NOTE) {
				// calculate and sum weights
				item.weight = item.romaji.length;

				// duplicate romaji
				item.remainingRomaji = item.romaji;

				// calculate density
				item.density = item.romaji.length / item.duration * 1000;

				if (youTyping.settings.mercy && item.density >= youTyping.settings.mercyBorder) {
					item.mercy = Math.floor(youTyping.settings.mercyBorder * item.duration / 1000);

					if (item.mercy === item.romaji.length) {
						item.mercy--;
					}

					if (item.mercy === 0) {
						if (item.romaji.length === 1) {
							item.mercy = false;
						} else {
							item.mercy = 1;
						}
					}
				} else {
					item.mercy = false;
				}

				if (item.mercy !== false) {
					item.weight = item.mercy;
				}

				totalWeight += item.weight;
			}
		});

		youTyping.totalWeight = totalWeight;
	};

	// romanize notes from specified index to lyric end
	// @param prefix: limit romanization to start with specified characters
	// if romanization succeeded and note.text is fully satisfied, this returns true.
	// if romanization failed, this returns false.
	// if romanization succeeded but text remains, this returns currently converted
	// romaji at all.
	var romanizeNotes = function (index, remainingString, prefix) {
		var note = youTyping.roll[index];

		assert(note.type === youTyping.itemType.NOTE);

		// inspection
		var leftString = '';
		var result;
		var found = youTyping.romanizationTable.some(function (rule) {
			if (
				startsWith(remainingString, rule.after) && (
					!prefix
					|| startsWith(rule.before, prefix)
					|| startsWith(prefix, rule.before)
				)
			) {
				var followingString = remainingString.slice(rule.after.length);

				var remainingPrefix;
				if (!prefix) {
					remainingPrefix = rule.before;
				} else if (rule.before.length >= prefix.length) {
					remainingPrefix = rule.before;
				} else {
					remainingPrefix = prefix;
				}
				remainingPrefix = remainingPrefix.slice(rule.before.length - rule.next.length);

				// if text doesn't remains
				if (followingString === '') {
					var nextNoteIndex = findNextNote(index);

					// if next note doesn't exist
					if (nextNoteIndex === null) {
						// if prefix remains, it can never be satisfied.
						if (remainingPrefix) {
							return false;
						} else {
							// if note is satisfied
							if (remainingString === note.text) {
								note.romaji = rule.before.slice(0, rule.next ? -1 : undefined);
								note.remainingRomaji = note.romaji;
							} else {
								leftString = rule.before.slice(0, rule.next ? -1 : undefined);
							}
							return true;
						}
					}
					// if next note exists
					else {
						var nextNote = youTyping.roll[nextNoteIndex];
						result = romanizeNotes(nextNoteIndex, nextNote.text, remainingPrefix);

						// note must be satisfied or failed
						assert(typeof result === 'boolean');

						if (result) {
							// if note is satisfied
							if (remainingString === note.text) {
								note.romaji = rule.before.slice(0, rule.next ? -1 : undefined);
								note.remainingRomaji = note.romaji;
							} else {
								leftString = rule.before.slice(0, rule.next ? -1 : undefined);
							}
							return true;
						} else {
							return false;
						}
					}
				}
				// if text remains
				else {
					result = romanizeNotes(index, followingString, remainingPrefix);

					// result mustn't be satisfied
					assert(result !== true);

					// if romanization failed
					if (result === false) {
						return false;
					}
					// if note is satisfied
					else if (remainingString === note.text) {
						note.romaji = rule.before.slice(0, rule.next ? -1 : undefined) + result;
						note.remainingRomaji = note.romaji;
					}
					// if note isn't satisfied
					else {
						leftString = rule.before.slice(0, rule.next ? -1 : undefined) + result;
					}

					return true;
				}
			} else {
				return false;
			}
		});

		if (!found) {
			return false;
		} else {
			if (leftString) {
				return leftString;
			} else {
				return true;
			}
		}
	};

	// return next valid note
	var findNextNote = function (noteIndex) {
		var nextNote = null;

		for (var i = noteIndex + 1; i < youTyping.roll.length; i++) {
			var item = youTyping.roll[i];
			if (item.type === youTyping.itemType.STOP) {
				nextNote = null;
				break;
			}
			if (item.type === youTyping.itemType.NOTE) {
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
			if (item.type === youTyping.itemType.LYRIC) {
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
		with enough interval time (10ms) to detect when the `getCurrentTime()` time
		jumped up to another value. And each time `gotCurrentTime` jumped (nameed `ZeroCall`),
		YouTyping assumes the time to be correct and counts backward to estimate
		when this video started, so the time is nameed `ZeroTime`. Then the current playing time
		of video will be calculated by `ZeroTime` and current time taken from browser clock
		(very highly resoluted as <1ms).

		***************/

		var now = youTyping.now;
		var gotCurrentTime = youTyping.player.getCurrentTime();
		var gotPlayerState = youTyping.player.getPlayerState();

		if (gotPlayerState === YT.PlayerState.PLAYING) {
			if (youTyping.currentTime !== gotCurrentTime
			    && gotCurrentTime > youTyping.settings.offset) { // if Current Time jumped
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

				// `zeroTimePad` is actual estimated ZeroTime and real displayed ZeroTime is
				// modested into `zeroTime`.
				youTyping.zeroTimePad = estimatedSum / youTyping.estimateSamples.length
				                        + youTyping.correction;

				// stop video when the time exceeded
				if (youTyping.settings.videoStop !== 0
				    && gotCurrentTime > youTyping.settings.videoStop) {
					youTyping.player.stopVideo();
				}

				youTyping.zeroCallFPS++;
			}
			// if player is playing, set youTyping.time according to zero time,
			// against the case when player is stopping.
			youTyping.time = now - youTyping.zeroTime;
			// pad zero time on every frames
			youTyping.zeroTime = (youTyping.zeroTime - youTyping.zeroTimePad) * 0.9
			                     + youTyping.zeroTimePad;
		} else if (gotPlayerState === YT.PlayerState.ENDED) {
			// if video ended and game is still playing, zeroTime is fixed. nothing to do here.
		} else {
			// if player is stopping, we're waiting for starting video.
			// set zero time according to youTyping.time, against the case when player is playing.
			youTyping.zeroTime = youTyping.zeroTimePad
			                   = now - youTyping.settings.offset * 1000
			                     + youTyping.correction - youTyping.time;
		}

		// mark past notes as failed
		var time = youTyping.time;
		var previousLiveNote = null;
		var previousLiveNoteIndex = null;
		youTyping.roll.forEach(function (note, index) {
			// if it's note and passed
			if (note.type === youTyping.itemType.NOTE
			    && note.time + youTyping.settings.failureSuspension < time) {
				// and if the note is live
				if (note.state === youTyping.noteState.WAITING
				 || note.state === youTyping.noteState.HITTING) {
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
			} else if (note.type === youTyping.itemType.LYRIC && note.time < time) {
				// update current lyric index
				if (youTyping.nextLyricIndex !== null
				    && youTyping.nextLyricIndex <= index) {
					youTyping.currentLyricIndex = index;
					youTyping.nextLyricIndex = findNextLyric(index);

					youTyping.dispatchEvent('lyricchange');
				}
			}
			// if order stop marks
			else if (note.type === youTyping.itemType.STOP && note.time < time) {
				// cancel current lyric
				if (youTyping.currentLyricIndex !== null
				    && youTyping.currentLyricIndex < index) {
					youTyping.currentLyricIndex = null;
					youTyping.dispatchEvent('lyricchange');
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

		// end game
		if (gameEndFlag) {
			gameEndFlag = false;
			endGame();
		}
	};

	// mark as failed
	var markFailed = function (note) {
		if (note.state === youTyping.noteState.WAITING) {
			note.state = youTyping.noteState.FAILED;
			note.judgement = 'neglect';
			youTyping.scorebook.neglect++;
		} else if (note.state === youTyping.noteState.HITTING) {
			note.state = youTyping.noteState.HITTINGFAILED;
			youTyping.scorebook.failed[note.judgement]++;
		}

		if (youTyping.lastNote.state !== youTyping.noteState.WAITING &&
		    youTyping.lastNote.state !== youTyping.noteState.HITTING) {
			gameEndFlag = true;
		}

		youTyping.combo = 0;
	};

	var endGame = function () {
		youTyping.dispatchEvent('gameend');
	};

	var getLastKeyHit = function () {
		if (youTyping.replay.length === 0) {
			return null;
		} else {
			return youTyping.replay[youTyping.replay.length - 1];
		}
	};

	var updateScore = function () {
		var scoredWeight = 0;

		youTyping.roll.forEach(function (item) {
			if (item.type === youTyping.itemType.NOTE) {
				if (item.judgement) {
					var weight = null;

					youTyping.settings.judges.forEach(function (judge) {
						if (judge.name === item.judgement) {
							weight = judge.weight;
						}
					});

					if (weight !== null) {
						if (item.state === youTyping.noteState.CLEARED) {
							scoredWeight += item.weight * weight;
						} else {
							scoredWeight += item.weight * weight * 0.5;
						}
					}
				}
			}
		});

		youTyping.score = Math.floor(
			70000 * scoredWeight / youTyping.totalWeight
			+ 30000 * youTyping.scoredCombo / youTyping.totalCombo
		) * 10;
	};


	/******************* Exposed Methods *******************/

	this.play = function () {
		youTyping.player.playVideo();
		youTyping.player.seekTo(youTyping.settings.offset);

		youTyping.isPlayingGame = true;
		youTyping.gameLoopId = setInterval(gameLoop, 10);

		setTimeout(function () {
			// if still buffering after 3 seconds
			if (youTyping.player.getPlayerState() === YT.PlayerState.BUFFERING) {
				// seek again... fix problems in long video
				youTyping.player.seekTo(youTyping.settings.offset);
			}
		}, 3000);
	};

	// hit key
	// TODO: make HitEvent interface
	this.hit = function (key, time, forceHit) {
		if (!time) {
			time = youTyping.now - youTyping.zeroTime;
		}

		// check hit-ability of note by passed key.
		// return false when un-hit-able, and info about new note when hit-able
		var preHitNote = function (noteIndex, hitKey, remainingText) {
			var note = youTyping.roll[noteIndex];
			var newInputBuffer = '';

			if (noteIndex === youTyping.currentNoteIndex) {
				newInputBuffer = youTyping.inputBuffer + key;
			} else { // discard input buffer if not hitting current note
				newInputBuffer = key;
			}

			hitKey = hitKey || key;
			remainingText = remainingText || note.remainingText;

			var matchingRules = youTyping.table.filter(function (rule) {
				// currently YouTyping assumes no character in lyric cannnot be input as
				// single character. (e.g. 'きゃ' is also inputtable as 'ki lya' in romaji mode)
				// so YouTyping spares no effort to find special combination of
				// rules that can generate ramaining text, but it deserves consideration to
				// prevent evel behavior of breaking conversion table input.
				if (!startsWith(rule.before, newInputBuffer)) {
					return false;
				}
				if (!startsWith(remainingText, rule.after)) {
					return false;
				}

				// if rule has next character and not yet satisfied
				if (rule.next && newInputBuffer.length < rule.before.length) {
					// check for hittability of next string by next character.

					var nextNoteIndex;
					var nextNoteInfo;

					// if text remains
					if (remainingText.length > rule.after.length) {
						// try to hit current note
						var remainingString = remainingText.slice(rule.after.length);
						nextNoteInfo = preHitNote(noteIndex, rule.next, remainingString);

						// if note is still hittable, return true.
						if (nextNoteInfo) {
							return true;
						} else {
							return false;
						}
					}
					// else if next note exists
					else if ((nextNoteIndex = findNextNote(noteIndex)) !== null) {
						// try to hit next note
						nextNoteInfo = preHitNote(nextNoteIndex, rule.next);

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
					newNoteInfo.remainingText = remainingText.substr(minimumRule.after.length);
					newNoteInfo.inputBuffer = '';

					if (minimumRule.next) {
						// https://github.com/hakatashi/YouTyping/wiki/Forced-hit
						newNoteInfo.forcedHit = minimumRule.next;
					}
				} else {
					newNoteInfo.remainingText = remainingText;
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

			// record romaji and regenerate romanizations
			note.receivedRomaji += key;
			if (note.remainingRomaji.slice(0, 1) !== key) {
				romanizeNotes(newNoteInfo.noteIndex, note.text, note.receivedRomaji);
				note.remainingRomaji = note.romaji.slice(note.receivedRomaji.length);
			} else {
				note.remainingRomaji = note.remainingRomaji.slice(1);
			}

			if (newNoteInfo.remainingText === '' || (
				note.mercy !== false
				&& note.receivedRomaji.length >= note.mercy
			)) {
				note.state = youTyping.noteState.CLEARED;
				note.remainingText = '';
				youTyping.inputBuffer = '';
				youTyping.currentNoteIndex = null;

				// record in scorebook
				youTyping.scorebook.cleared[note.judgement]++;
			} else {
				note.state = youTyping.noteState.HITTING;
				note.remainingText = newNoteInfo.remainingText;
				youTyping.inputBuffer = newNoteInfo.inputBuffer;
			}

			// mark all the previous note failed
			youTyping.roll.forEach(function (item, index) {
				if (item.type === youTyping.itemType.NOTE && item.time < note.time) {
					if (item.state === youTyping.noteState.WAITING
					    || item.state === youTyping.noteState.HITTING) {
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
			    youTyping.lastNote.state !== youTyping.noteState.HITTING &&
			    youTyping.lastNote.state !== youTyping.noteState.MERCIFIED) {
				gameEndFlag = true;
			}
		};

		// key hit must be single stroke
		if (key.length !== 1) {
			return;
		}

		// key hit mustn't fire before last key hit
		var lastKeyHit = getLastKeyHit();
		if (lastKeyHit && time < lastKeyHit.time) {
			return;
		}

		// record key hit to replay
		youTyping.replay.push({
			time: time,
			key: key
		});

		// if currently hitting some note, try to hit it to complete
		if (youTyping.currentNoteIndex !== null) {
			var newNoteInfo = preHitNote(youTyping.currentNoteIndex);

			if (newNoteInfo) { // if current note is hit-able
				hitNote(newNoteInfo);
				updateScore();
				return;
			}
		}

		// search for nearest note that matches currently passed key rule
		var worstJudge = youTyping.settings.judges[youTyping.settings.judges.length - 1];

		var nearestNote = null;
		var nearestNewNote = null;
		var nearestDistance = Infinity;
		youTyping.roll.forEach(function (item, index) {
			if (item.type === youTyping.itemType.NOTE) {
				var distance = item.time - time;

				if (
					(
						forceHit || (
							worstJudge.from <= distance
							&& distance <= worstJudge.to
						)
					)
					// Luckily `positive number` > null is always true :)
					&& index > youTyping.currentNoteIndex
					&& item.state === youTyping.noteState.WAITING
					&& Math.abs(distance) < Math.abs(nearestDistance)
				) {
					var newNoteInfo = preHitNote(index);

					if (newNoteInfo) {
						nearestNote = item;
						nearestNewNote = newNoteInfo;
						nearestDistance = distance;
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
				// if currently hitting other note now, it will be
				// marked as HITTINGFAILED
				if (youTyping.currentNoteIndex !== null) {
					var previousNote = youTyping.roll[youTyping.currentNoteIndex];
					markFailed(previousNote);
				}

				// update current note judgement
				nearestNote.judgement = hitJudge;

				// breaking combo
				// TODO: when hit judge is poor than break combo
				if (hitJudge === youTyping.settings.breakCombo) {
					youTyping.combo = 0;
				}

				// hit note
				// combo may be reset here
				hitNote(nearestNewNote);

				youTyping.combo++;

				// update max combo
				if (youTyping.combo > youTyping.maxCombo) {
					youTyping.maxCombo = youTyping.combo;
				}

				// score combo bonus
				if (youTyping.combo > 50) {
					youTyping.scoredCombo += 50;
				} else {
					youTyping.scoredCombo += youTyping.combo;
				}

				updateScore();

				// trigger judgement effect
				youTyping.dispatchEvent('judgement', {
					judgement: {
						distance: distance,
						judge: hitJudge,
						combo: youTyping.combo
					},
					noteIndex: nearestNewNote
				});
			}
		}
	};

	// abort currently playing game and restart YouTyping
	this.reset = function () {
		// stop game loop
		clearInterval(youTyping.gameLoopId);
		// re-initialize YouTyping
		youTyping.initialize();
		// and re-initialize roll
		initializeRoll();
		// and re-calculate weight
		calculateWeight();
		// also break the flag
		youTyping.isPlayingGame = false;

		// pause video
		youTyping.player.pauseVideo();
		// and seek to offset
		youTyping.player.seekTo(youTyping.settings.offset);
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
			if (youTyping.roll[i].type === youTyping.itemType.NOTE) {
				kanaLyric += youTyping.roll[i].text;
			} else if (
				youTyping.roll[i].type === youTyping.itemType.STOP ||
				youTyping.roll[i].type === youTyping.itemType.LYRIC
			) {
				break;
			}
		}

		return kanaLyric;
	};

	// Event listener pseudo-implementation

	// Available events:
	// [x] resourceready
	// [x] gameready
	// [x] playerstatechange
	// [ ] miss
	// [ ] hit
	// [x] judgement
	// [ ] noteclear
	// [x] lyricchange
	// [ ] scorechange
	// [ ] videoend
	// [x] gameend
	// [ ] error
	this.addEventListener = function (type, listener) {
		if (youTyping.events[type] === undefined) {
			youTyping.events[type] = [];
		}

		youTyping.events[type].push(listener);
	};

	this.removeEventListener = function (type, listener) {
		if (youTyping.events[type] === undefined) {
			youTyping.events[type] = [];
		}

		for (var i = youTyping.events[type].length - 1; i >= 0; i--) {
			if (youTyping.events[type][i] === listener) {
				youTyping.events[type].splice(i, 1);
			}
		}
	};

	// wow so dispatching very pseudo
	this.dispatchEvent = function (type, properties) {
		if (youTyping.events[type] === undefined) {
			youTyping.events[type] = [];
		}

		youTyping.events[type].forEach(function (listener) {
			listener.call(screen, properties);
		});
	};


	/******************* Initialization *******************/

	youTyping.totalWeight = 0;
	youTyping.totalCombo = 0;
	youTyping.events = {};

	this.initialize = function () {
		// ZeroTime calculation
		youTyping.zeroTime = 0;
		youTyping.zeroTimePad = 0;
		youTyping.currentTime = 0;
		youTyping.estimateSamples = [];
		youTyping.estimatedZero = 0; // exposed only for debugging
		youTyping.zeroCallFPS = 0; // exposed only for debugging

		// calculate correction
		youTyping.correction = youTyping.settings.correction
		                       + youTyping.settings.controlledCorrection
		                       + youTyping.settings.offset * 1000;
		// initialize zeroTime
		youTyping.zeroTimePad = youTyping.correction - youTyping.settings.offset * 1000;
		youTyping.zeroTime = youTyping.correction - youTyping.settings.offset * 1000;

		// time in roll
		youTyping.time = 0;

		// key input
		youTyping.currentNoteIndex = null;
		youTyping.inputBuffer = '';

		// lyrics
		youTyping.currentLyricIndex = null;
		youTyping.nextLyricIndex = null; // initialized in loadXML()

		// game state
		youTyping.isPlayingGame = false;

		// score and combo
		youTyping.combo = 0;
		youTyping.maxCombo = 0;
		youTyping.score = 0;
		youTyping.scoredCombo = 0;

		// replay and keypress manager
		youTyping.replay = [];

		// initialize scorebook
		youTyping.scorebook = {};
		youTyping.scorebook.failed = {};
		youTyping.scorebook.cleared = {};
		youTyping.scorebook.neglect = 0;
		youTyping.settings.judges.forEach(function (judge) {
			youTyping.scorebook.failed[judge.name] = 0;
			youTyping.scorebook.cleared[judge.name] = 0;
		});

		// internal
		gameEndFlag = false;
	};

	this.initialize();

	// Initialize asynchronously
	// http://stackoverflow.com/questions/22346345/
	$.when(
		$.when(
			loadDataXML(),
			loadTable()
		).done(
			calculateWeight,
			youTyping.dispatchEvent.bind(undefined, 'resourceready')
		),
		setupPlayer()
	).done(youTyping.dispatchEvent.bind(undefined, 'gameready'))
	.fail(function () {
		logTrace('ERROR: Initialization Failed...');
	});
};
