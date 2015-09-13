var fs = require('fs');
var optimist = require('optimist');
var path = require('path');
var Iconv = require('iconv').Iconv;
var xml2js = require('xml2js');

require('sugar');

// parse options
var options = optimist.options('output', {
	alias: 'o',
	'default': 'stdout'
}).options('resource', {
	alias: 'r',
	'default': ''
}).options('note', {
	alias: 'n',
	'default': ''
}).options('shift', {
	alias: 's',
	'default': 0
}).argv;

if (options._.length < 1) {
	console.error('Error: Please supply input file name(s).');
	process.exit();
}

// initiate utf file object
var utx = {
	$: {
		version: '0.1'
	},
	data: {
		music: '',
		resource: '',
		info: '',
		roll: ''
	}
};

// setup xml builder
var builder = new xml2js.Builder({
	explicitRoot: false,
	rootName: 'utx',
	explicitArray: false
});

// setup encoder
var iconv = new Iconv('Shift_JISX0213', 'UTF-8');

// read roll file
var rollText = iconv.convert(fs.readFileSync(options._[0])).toString();

// read info file
var infoText;
if (options._[1]) {
	infoText = iconv.convert(fs.readFileSync(options._[1])).toString();
} else {
	infoText = null;
}

// item types dictionary
var itemTypes = {
	'=': 'longline',
	'-': 'line',
	'*': 'lyric',
	'+': 'note',
	'/': 'stop'
};

// extract creator dictionary
var extractCreator = {
	'作詞': 'lyricyst',
	'作曲': 'composer',
	'編曲': 'arranger',
	'唄': 'singer',
	'歌': 'singer',
	'うた': 'singer'
};

/******** Parser ********/

try {
	var rollLines = rollText.replace(/\r\n/g, '\n').split('\n');

	// first line of roll file describes music file name
	if (rollLines[0].startsWith('@')) {
		utx.data.music = rollLines[0].slice(1);
	} else {
		throw 'Music line is invalid';
	}

	utx.data.resource = options.resource;

	// load items
	utx.data.roll = {};
	utx.data.roll.item = [];
	for (var i = 1; i < rollLines.length; i++) {
		var rollLine = rollLines[i];

		// ignore empty line
		if (rollLine.length === 0) {
			continue;
		}

		var type = itemTypes[rollLine[0]];

		if (typeof type === 'undefined') {
			throw 'File ' + options._[0] + ' Line ' + i + ': Unknown item type \'' + type + '\'';
		}

		var time = parseFloat(rollLine.slice(1).split(/ (.+)?/)[0]);
		time = (time + options.shift / 1000).round(6);
		var text = rollLine.slice(1).split(/ (.+)?/)[1];

		if (text) {
			utx.data.roll.item.push({
				$: {
					time: time,
					type: type
				},
				text: text
			});
		} else {
			// lyric and note must have text field
			if (type === 'lyric' || type === 'note') {
				throw 'File ' + options._[0] + ' Line ' + i + ': Text field not found';
			}
			utx.data.roll.item.push({
				$: {
					time: time,
					type: type
				}
			});
		}
	}

	// parse info file
	if (infoText) {
		utx.data.info = {};

		var infoLines = infoText.split('\r\n');

		// info file must have at least six lines
		if (infoLines.length < 6) {
			throw 'File ' + options._[1] + ': Info file must have at least six lines';
		}

		// store info into corresponding fields
		utx.data.info.title = infoLines[0];
		utx.data.info.artist = infoLines[1];
		utx.data.info.maker = infoLines[2];
		utx.data.info.difficulty = infoLines[3];
		utx.data.info.datafile = infoLines[4];
		utx.data.info.scorefile = infoLines[5];

		var description = infoLines.from(6);
		utx.data.info.description = description.map(function (line) {
			return line.escapeHTML();
		}).join('<br>'); // escape and join with breakline

		utx.data.info.note = options.note;

		// extract extra information from description
		utx.data.info.creator = [];
		description.forEach(function (line) {
			for (creatorType in extractCreator) {
				if (extractCreator.hasOwnProperty(creatorType)) {
					if (line.startsWith(creatorType)) {
						var creator = line.slice(creatorType.length).trim();
						var type = extractCreator[creatorType];

						utx.data.info.creator.push({
							_: creator,
							$: {
								type: type
							}
						});
					}
				}
			}
		});
	}
} catch (exception) {
	console.error('Parse error: ' + exception);
	process.exit();
}

// build xml
var xml = builder.buildObject(utx);

// setup stream
var stream;
if (options.output === 'stdout') {
	stream = process.stdout;
} else {
	stream = fs.createWriteStream(options.output, {
		encoding: 'utf8'
	});
}

stream.write(xml);
