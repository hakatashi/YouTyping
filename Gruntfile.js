module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
			    separator: '\n\n'
			},
			youtyping: {
				src: ['src/control.js', 'src/util.js'],
				dest: 'youtyping.js',
				options: {
					banner: '/* youtyping.js <%= grunt.template.today("mm-dd-yyyy") %> */\n\n(function(exports){\n',
					footer: '\n\nexports.YouTyping = YouTyping;\n}(typeof window === \'undefined\' ? module.exports : window));'
				}
			},
			screen: {
				src: ['src/screen.js', 'src/util.js'],
				dest: 'youtyping-screen.js',
				options: {
					banner: '/* youtyping-screen.js <%= grunt.template.today("mm-dd-yyyy") %> */\n\n(function(exports){\n',
					footer: '\n\nexports.Screen = Screen;\n}(typeof window === \'undefined\' ? module.exports : window));'
				}
			}
		},
		uglify: {
			youtyping: {
				options: {
					banner: '/* youtyping.js <%= grunt.template.today("mm-dd-yyyy") %> */\n'
				},
				files: {
					'youtyping.min.js': ['<%= concat.youtyping.dest %>']
				},
				options: {
					sourceMap: true
				}
			},
			screen: {
				options: {
					banner: '/* youtyping-screen.js <%= grunt.template.today("mm-dd-yyyy") %> */\n'
				},
				files: {
					'youtyping-screen.min.js': ['<%= concat.screen.dest %>']
				},
				options: {
					sourceMap: true
				}
			}
		},
		jshint: {
			options: {
				camelcase: true,
				curly: true, // no more GOTO FAIL ;)
				eqeqeq: true,
				es3: true,
				forin: true,
				newcap: true,
				nonbsp: true,
				quotmark: true,
				multistr: true,
				laxbreak: true
			},
			src: {
				src: ['src/*.js']
			},
			youtyping: {
				src: ['youtyping.js'],
				options: {
					undef: true,
					browser: true,
					node: true,
					jquery: true,
					devel: true,
					globals: {
						// YouTube Iframe Player API
						YT: false,
						// paper.js
						paper: false
					}
				}
			},
			screen: {
				src: ['youtyping-screen.js'],
				options: {
					undef: true,
					browser: true,
					node: true,
					jquery: true,
					devel: true,
					globals: {
						// YouTube Iframe Player API
						YT: false,
						// paper.js
						paper: false,
						// YouTyping interfaces
						YouTyping: true
					}
				}
			}
		},
		connect: {
			server: {
				options: {
					port: 8080,
					debug: true,
					keepalive: true,
					open: 'http://localhost:8080/sample/'
				}
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-connect');

	grunt.registerTask('default', ['concat', 'jshint', 'uglify']);
	grunt.registerTask('debug', ['concat', 'jshint', 'uglify', 'connect']);
};
