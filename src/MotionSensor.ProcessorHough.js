;(function (MotionSensor) {

    var distance2 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
    };

    var distance3 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
    };

    var drawingWidth = 640;
    var drawingHeight = 480;
    var numAngleCells = 360;
    var rhoMax = Math.sqrt(drawingWidth * drawingWidth + drawingHeight * drawingHeight);
    var accum = Array(numAngleCells);

    // Precalculate tables.
    var cosTable = Array(numAngleCells);
    var sinTable = Array(numAngleCells);
    for (var theta = 0, thetaIndex = 0; thetaIndex < numAngleCells; theta += Math.PI / numAngleCells, thetaIndex++) {
        cosTable[thetaIndex] = Math.cos(theta);
        sinTable[thetaIndex] = Math.sin(theta);
    }

    // Implementation with lookup tables.
    function houghAcc(x, y, newpx) {
        var rho;
        var thetaIndex = 0;
        var i, xdx, ydy;
        x -= drawingWidth / 2;
        y -= drawingHeight / 2;
        for (; thetaIndex < numAngleCells; thetaIndex++) {
            rho = rhoMax + x * cosTable[thetaIndex] + y * sinTable[thetaIndex];
            rho >>= 1;
            if (accum[thetaIndex] == undefined) accum[thetaIndex] = [];
            if (accum[thetaIndex][rho] == undefined) {
                accum[thetaIndex][rho] = 1;
            } else {
                accum[thetaIndex][rho]++;
            }

            xdx = Math.floor(drawingWidth/2 + thetaIndex - 40);
            ydy = Math.floor(rho - drawingHeight/2);
            i = (ydy*drawingWidth + xdx)*4;
            newpx[i+3] *= .9;
        }
    }

    MotionSensor.ProcessorHough = function (motionSensor) {
        // IoC
        this.motionSensor = motionSensor;
        this.context = motionSensor.canvasContext;

        this.i = 0; // frame counter
        this.clustersBuffer = [];
        this.convexHull = new motionSensor.constructor.ConvexHull();
        this.superClustersBuffer = [];
    }

    MotionSensor.ProcessorHough.prototype.processCircularBuffer = function (originalImageData, imageDataBuffers) {
        this.i++;

        var imageDataBuffersN = imageDataBuffers.length;

        var ctx = this.context;

        var videodata = originalImageData,
            videopx = videodata.data,
            newdata = imageDataBuffers[imageDataBuffersN-1],
            newpx = newdata.data,
            len = newpx.length;

        var MOTION_COLOR_THRESHOLD = 50,
            SAMPLING_GRID_FACTOR = Math.floor(2/this.motionSensor.scale), // 2 - 8
            MOTION_ALPHA_THRESHOLD = 120,
            i = l = x = y = 0,
            w = VIDEO_WIDTH = this.motionSensor.VIDEO_WIDTH,
            h = VIDEO_HEIGHT = this.motionSensor.VIDEO_HEIGHT;

        var k = this.motionSensor.options.totalClusters,
            clusters = [],
            points = [];

        // iterate through the main buffer and calculate the differences with previous
        for (i = 0; i < len; i += 4) {
            // change the alpha channel based on the frame color differences
            alpha = 255;
            for (var j = 0, l = imageDataBuffersN-1; j < l; j++) {
                if (distance3(imageDataBuffers[j].data, imageDataBuffers[j+1].data, i) < MOTION_COLOR_THRESHOLD) {
                    alpha -= 255/l;
                }
            }
            x = (i/4) % w;
            y = parseInt((i/4) / w);
            if (this.i > imageDataBuffersN && (!(x % SAMPLING_GRID_FACTOR) && !(y % SAMPLING_GRID_FACTOR)) && alpha > MOTION_ALPHA_THRESHOLD) {
                if (Math.random() < this.motionSensor.scale) {
                    houghAcc(x, y, newpx);
                }
            }
        }
        ctx.putImageData(imageDataBuffers[imageDataBuffersN-1], 0, 0);

    };

}(MotionSensor));
