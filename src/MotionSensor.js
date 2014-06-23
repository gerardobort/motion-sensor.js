;(function (window, document) {

    var MotionSensor = function (options) {
        this.options = options;

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'motion-sensor';
        this.canvas.style.webkitTransform = 'scaleX(-1)'; // TODO redo: hack for mirroring

        this.video = document.createElement('video');
        this.video.autoplay = 'true';
        this.video.style.display = 'none';


        this.videoScale = this.options.videoScale || 1;
        this.VIDEO_WIDTH = this.videoScale*640;
        this.VIDEO_HEIGHT = this.videoScale*480;
        this.canvas.width = this.VIDEO_WIDTH;
        this.canvas.height = this.VIDEO_HEIGHT;
        this.video.width = this.VIDEO_WIDTH;
        this.video.height = this.VIDEO_HEIGHT;

        this.setScale(options.initialScale || .25);

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
        this.processorConstructor = options.processor || this.constructor.Processor;
        this.performanceController = new this.constructor.PerformanceController(this);
    };

    MotionSensor.prototype.start = function () {
        var instance = this;

        instance.processor = new instance.processorConstructor(instance);

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

    window.MotionSensor = MotionSensor;

}(window, document));
