;(function (window, document) {

    var MotionSensor = function (options) {
        this.options = options;

        this.canvas = document.createElement('canvas');
        this.canvas.style.webkitTransform = 'scaleX(-1)'; // TODO redo: hack for mirroring

        this.video = document.createElement('video');
        this.video.autoplay = 'true';
        this.video.style.display = 'none';

        this.setScale(options.initialScale || .35);

        var body = document.getElementsByTagName('body')[0];
        body.appendChild(this.canvas);
        body.appendChild(this.video);

        this.canvasContext = this.canvas.getContext('2d');

        // initialize variables
        if (options.totalBuffers < 2) {
            throw 'MotionSensor: Wrong setting: totalBuffers must be 2 or higher.';
        } else if (options.totalBuffers < 3) {
            console.log('MotionSensor: Warning: It\'s not possible to compute cluster directions when using 2 buffers.');
        }
        this.imageDataBuffersN = options.totalBuffers;
        this.imageDataBuffers = [];
        for (var i = 0, l = this.imageDataBuffersN; i < l; i++) {
            this.imageDataBuffers.push(this.canvasContext.createImageData(this.VIDEO_WIDTH, this.VIDEO_HEIGHT));
        }

        this.attachedEvents = {};
        this.performanceController = new this.PerformanceController(this);
    };

    MotionSensor.prototype.start = function () {
        var instance = this;

        instance.processor = new instance.Processor(instance);

        navigator.webkitGetUserMedia({ video: true },
            function (stream) {
                // replace with another video source if needed
                instance.video.src = webkitURL.createObjectURL(stream);
                webkitRequestAnimationFrame(instance.updateCanvas.bind(instance));
                console.log('MotionSensor started.');
                instance.trigger('start', [instance.canvas, instance.canvasContext])
            },
            function () {
                throw 'MotionSensor error during webcam initialization.';
            }
        );
    };

    MotionSensor.prototype.setScale = function (scale) {
        this.scale = scale;
        this.VIDEO_WIDTH = this.scale*640;
        this.VIDEO_HEIGHT = this.scale*480;

        this.canvas.width = this.VIDEO_WIDTH;
        this.canvas.height = this.VIDEO_HEIGHT;
        this.video.width = this.VIDEO_WIDTH;
        this.video.height = this.VIDEO_HEIGHT;
    };

    MotionSensor.prototype.updateCanvas = function () {
        var instance = this;
        instance.canvasContext.drawImage(instance.video, 0, 0, this.VIDEO_WIDTH, this.VIDEO_HEIGHT);
        instance.originalImageData = instance.canvasContext.getImageData(0, 0, this.VIDEO_WIDTH, this.VIDEO_HEIGHT);

        // shift imageDataBuffers and store the last one
        for (var i = 0, l = instance.imageDataBuffersN-1; i < l; i++) {
            instance.imageDataBuffers[i] = instance.imageDataBuffers[i+1];
        }
        instance.imageDataBuffers[l] = instance.canvasContext.createImageData(this.VIDEO_WIDTH, this.VIDEO_HEIGHT);
        instance.imageDataBuffers[l].data.set(instance.originalImageData.data);

        instance.processor.processCircularBuffer(instance.originalImageData, instance.imageDataBuffers);

        instance.performanceController.setFrameMark();
        instance.performanceController.control();

        // do while 1
        webkitRequestAnimationFrame(instance.updateCanvas.bind(instance));
    };

    MotionSensor.prototype.on = function (eventName, handler) {
        if (!this.attachedEvents[eventName]) {
            this.attachedEvents[eventName] = [];
        }
        this.attachedEvents[eventName].push(handler);
    };

    MotionSensor.prototype.trigger = function (eventName, params) {
        if (!this.attachedEvents[eventName]) {
            return;
        }
        for (var i = 0; i < this.attachedEvents[eventName].length; i++) {
            if (false === this.attachedEvents[eventName][i].apply(params[0]||this, params)) {
                return;
            }
        }
    };


    var distance2 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2));
    };

    var distance3 = function (v1, v2, i) {
        return Math.sqrt(Math.pow(v1[i+0] - v2[i+0], 2) + Math.pow(v1[i+1] - v2[i+1], 2) + Math.pow(v1[i+2] - v2[i+2], 2));
    };

    MotionSensor.Vector2 = function(x, y) {
        this.x = x;
        this.y = y;
    };
    MotionSensor.Vector2.prototype.getDistance = function(v2) {
        return Math.sqrt(Math.pow(this.x - v2.x, 2) + Math.pow(this.y - v2.y, 2));
    };

    MotionSensor.Vector3 = function(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    };
    MotionSensor.Vector3.prototype.getDistance = function(v3) {
        return Math.sqrt(Math.pow(this.x - v3.x, 2) + Math.pow(this.y - v3.y, 2) + Math.pow(this.z - v3.z, 2));
    };
    MotionSensor.Vector3.prototype.dotProduct = function(k) {
        this.x*=k;
        this.y*=k;
        this.z*=k;
    };

    MotionSensor.Vector4 = function(x, y, z, t) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.t = t;
    };
    MotionSensor.Vector4.prototype.getDistance = function(v4) {
        return Math.sqrt(0.5*Math.pow(this.x - v4.x, 2) + 0.5*Math.pow(this.y - v4.y, 2) + 10*Math.pow(this.z - v4.z, 2) + 10*Math.pow(this.t - v4.t, 2));
    };
    MotionSensor.Vector4.prototype.dotProduct = function(k) {
        this.x*=k;
        this.y*=k;
        this.z*=k;
        this.t*=k;
    };

    MotionSensor.Pixel = function(v2Position, v3Color) {
        this.position = v2Position;
        this.color = v3Color;
    };

    window.MotionSensor = MotionSensor;

}(window, document));
