var gulp    = require('gulp');
var path    = require('path');
var bsync   = require('browser-sync').create();
var reload  = bsync.reload;
var $       = require('gulp-load-plugins')({ rename: {
                    'gulp-clean-css':'cssmin',
                    'gulp-scss-lint':'scsslint'
                } });
var mainBowerFiles = require('main-bower-files');
var merge = require('merge-stream');

gulp.task('clean', function () {
    return gulp.src(['dist'], {read: false})
        .pipe($.clean());
});

gulp.task('styles', function () {
    return gulp.src('app/sass/**/*.scss')
        .pipe($.plumber())    
        .pipe($.scsslint())
        .pipe($.sass({
          includePaths:['./bower_components/bootstrap-sass/assets/stylesheets/'],
          outputStyle:'compressed'
        }))
        .pipe($.concat('app.css'))
        .pipe($.cssmin())
        .pipe(gulp.dest('dist'))
        .pipe(reload({stream:true}));
});

gulp.task('vendorjs', function(){
    var jsfilter = $.filter('**/*.js');
    var bower = gulp.src(mainBowerFiles())
        .pipe(jsfilter)
        .pipe($.concat('vendor.js'))
        .pipe($.uglify())
        .pipe(gulp.dest('dist'));

    // var misc = gulp.src('app/lib/**/*.js')
    //     .pipe(jsfilter)
    //     .pipe($.concat('vendor2.js'))
    //     .pipe($.uglify())
    //     .pipe(gulp.dest('dist'));
    // return merge(bower, misc);
    
    return bower;
});

gulp.task('appjs', function () {
    return gulp.src('app/scripts/**/*.js')
        .pipe($.plumber())
        .pipe($.jshint({esversion:6}))
        .pipe($.jshint.reporter(require('jshint-stylish')))
        .pipe($.concat('app.js'))
        .pipe($.uglify())
        .pipe(gulp.dest('dist'))
        .pipe(reload({stream:true}));
});

gulp.task('scripts', ['appjs', 'vendorjs']);

gulp.task('images', function () {
    return gulp.src('app/images/**/*')
        .pipe($.imagemin({
            optimizationLevel: 3,
            progressive: true,
            interlaced: true
        }))
        .pipe(gulp.dest('dist/images'));
});

gulp.task('fonts', function () {
    return gulp.src('app/**/fonts/**/*.{eot,svg,ttf,woff,woff2,otf}')
        .pipe($.flatten())
        .pipe(gulp.dest('dist/fonts'));
});

gulp.task('extras', function () {
    return gulp.src(['app/*.*', '!app/**/*.pug'], { dot: true })
        .pipe(gulp.dest('dist'));
});

gulp.task('check', function(){
    return gulp.src('gulpfile.js')
        .pipe($.jshint())
        .pipe($.jshint.reporter(require('jshint-stylish')));
 });

// https://github.com/sogko/gulp-recipes/tree/master/browser-sync-nodemon-expressjs

gulp.task('nodemon', function (cb) {
    var started = false;
    return $.nodemon({
        script: 'index.js'
    }).on('start', function () {
        // to avoid nodemon being started multiple times
        if (!started) {
            cb();
            started = true; 
        }
    });
});

gulp.task('serve', ['nodemon'], function() {
    bsync.init(null, {
        // server: "./dist"
        open: false,
        proxy: "localhost:4000",
        reloadDelay: 500
    });
    gulp.watch("app/sass/**/*.scss", ['styles']);
    gulp.watch("app/scripts/**/*.js", ['appjs']);
    gulp.watch("app/images/**", ['images']);
    gulp.watch("app/fonts/**", ['fonts']);
    gulp.watch("views/**/*.pug", reload);
});

gulp.task('build', ['clean'], function () {
    gulp.start('build-full');
});
gulp.task('build-full', ['styles', 'scripts', 'images', 'fonts', 'extras']);

gulp.task('default', ['styles', 'appjs', 'images', 'fonts'],function(){
    gulp.start('serve')
});