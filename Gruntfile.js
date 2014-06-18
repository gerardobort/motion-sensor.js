module.exports = function(grunt) {

    var properties = {
        srcPath: 'public/src',
        packageFiles: [
            "<%= properties.srcPath %>/MotionSensor.js",
            "<%= properties.srcPath %>/MotionSensor.PerformanceController.js",
            "<%= properties.srcPath %>/MotionSensor.Cluster.js",
            "<%= properties.srcPath %>/MotionSensor.Processor.js",
            "<%= properties.srcPath %>/MotionSensor.Processor2ClusterLevels.js",
            "<%= properties.srcPath %>/MotionSensor.ConvexHull.js",
        ]
    };

    grunt.config.set('properties', properties);

    grunt.initConfig({
        properties: properties,
        concat: {
            options: {
                separator: ';',
            },
            dist: {
                src: properties.packageFiles,
                dest: 'dist/motion-sensor.js',
            },
        },
        uglify: {
            options: {
                // preserveComments: 'all'
            },
            dist: {
                files: {
                    'dist/motion-sensor.min.js': properties.packageFiles,
                }
            }
        },
    });

    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('compile', [
        'concat:dist',
        'uglify:dist',
    ]);

};
