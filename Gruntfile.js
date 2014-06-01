module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
			    separator: '\n\n',
			    banner: '/* youtyping.js <%= grunt.template.today("mm-dd-yyyy") %> */\n\nvar YouTyping = (function(){\n',
			    footer: '\n\nreturn YouTyping;\n}());'
			},
			dist: {
				src: ['src/*.js'],
				dest: 'youtyping.js'
			}
		},
		uglify: {
			options: {
				banner: '/* youtyping.js <%= grunt.template.today("mm-dd-yyyy") %> */\n'
			},
			dist: {
				files: {
					'youtyping.min.js': ['<%= concat.dist.dest %>']
				}
			}
		},
		jshint: {
			options: {
				camelcase: true,
				curly: true,
				eqeqeq: true,
				es3: true,
				forin: true,
				newcap: true,
				noempty: true,
				nonbsp: true,
				quotmark: true
			},
			src: {
				src: ['src/*.js']
			},
			build: {
				src: ['youtyping.js'],
				options: {
					undef: true,
					browser: true,
					jquery: true,
					devel: true,
					globals: {
						// YouTube Iframe Player API
						onYouTubeIframeAPIReady: true,
						YT: false,
						// paper.js
						paper: false
					}
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');

	grunt.registerTask('default', ['concat', 'jshint', 'uglify']);
};
