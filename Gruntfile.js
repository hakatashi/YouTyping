module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
			    separator: '\n\n',
			    banner: '/* youtyping.js <%= grunt.template.today("mm-dd-yyyy") %> */\n\n(function(exports){\n',
			    footer: '\n\nexports.YouTyping = YouTyping;\nexports.Screen = Screen;\n}(typeof window === \'undefined\' ? module.exports : window));'
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
