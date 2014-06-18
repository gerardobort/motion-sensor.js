module.exports = function(grunt) {

    var properties = {
        srcPath: 'public/src'
    };

    grunt.config.set('properties', properties);

    grunt.initConfig({
        properties: properties,
        uglify: {
            options: {
                // preserveComments: 'all'
            },
            target: {
                files: {
                    'dist/motion-sensor.min.js': [
                        "<%= properties.srcPath %>/MotionSensor.js",
                        "<%= properties.srcPath %>/MotionSensor.PerformanceController.js",
                        "<%= properties.srcPath %>/MotionSensor.Cluster.js",
                        "<%= properties.srcPath %>/MotionSensor.Processor.js",
                        "<%= properties.srcPath %>/MotionSensor.ConvexHull.js",
                    ],
                }
            }
        },
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask('compile', [
        'uglify:target',
    ]);

};
