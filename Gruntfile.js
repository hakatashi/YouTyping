module.exports = function (grunt) {
	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		concat: {
			options: {
				separator: ''
			},
			dist: {
				src: ['src/*.js'],
				dest: 'youtyping.js'
			}
		},
		uglify: {
			options: {
				banner: '/* youtyping.js <%= grunt.template.today("dd-mm-yyyy") %> */\n'
			},
			dist: {
				files: {
					'youtyping.min.js': ['<%= concat.dist.dest %>']
				}
			}
		},
		jshint: {
			files: ['src/*.js']
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');

	grunt.registerTask('default', ['concat', 'jshint', 'uglify']);
};
