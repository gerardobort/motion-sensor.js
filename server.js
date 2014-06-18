var express = require('express'),
    app = express();

app
    .use(express.static('.'))
    .listen(process.env.PORT || 3000, function () {
        console.log('Motion Sensor sample server is listening on port ' + (process.env.PORT || 3000));
    });
