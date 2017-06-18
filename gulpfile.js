var gulp = require('gulp'),
	sass = require('gulp-sass'),
	autoprefixer = require('gulp-autoprefixer');

var icon = require('gulp-iconfont'),
	iconCSS = require('gulp-iconfont-css');

var concat = require('gulp-concat'),
	uglify = require('gulp-uglify');

var bowerPath = 'public/vendor/';
var sassPath = 'sass/';

/*
	SCSS(s) -> minified CSS
*/
gulp.task('sass', function() {
	gulp.src(sassPath+'app.scss')
		.pipe(sass({
			//outputStyle: 'compressed'
		}).on('error', sass.logError))
		.pipe(autoprefixer({
			browsers: ['last 8 versions']
		}))
		.pipe(concat('app.min.css'))
		.pipe(gulp.dest('./public/'));
});

/*
	.JS(s) -> minified JS
*/
gulp.task('js', function() {
	gulp.src([

		// Libraries
		bowerPath+'bowser/src/bowser.js', 
		bowerPath+'modernizr.min.js', 
		bowerPath+'jquery/dist/jquery.min.js', 
		bowerPath+'masonry/dist/masonry.pkgd.min.js', 
		bowerPath+'tether/dist/js/tether.js', 
		bowerPath+'bootstrap/dist/js/bootstrap.js',
		bowerPath+'selectize/dist/js/standalone/selectize.js',
		bowerPath+'oh-snap/ohsnap.min.js',
		bowerPath+'moment/moment.js',
		bowerPath+'firebase/firebase.js',

		// App
		bowerPath+'../firebase-messaging-sw.js',
		bowerPath+'app.js',
		
	])
		.pipe(concat('app.min.js'))
		.pipe(uglify().on('error', function(e) {
			console.error('Uglify error', e.cause ? {
				message: e.cause.message,
				filename: e.cause.filename,
				where: 'l'+e.cause.line+' (col'+e.cause.col+')',
			} : 'unknown error');

			return true;
		}))
		.pipe(gulp.dest('./public/'))
});

gulp.task('watch', function() {
	gulp.watch([bowerPath+'*.js'], ['js']).on('change', function(e) {
		console.log('File ' + e.path + ' was ' + e.type + ', running tasks...');
	});
	gulp.watch(sassPath+'**/*.scss', ['sass']).on('change', function(e) {
		console.log('File ' + e.path + ' was ' + e.type + ', running tasks...');
	});
});