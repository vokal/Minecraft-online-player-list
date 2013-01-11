var express = require('express');

var app = express(express.logger());
app.use(express.bodyParser());

app.post('/update', function(req, res) {
    console.log(req.body);
    res.send('OKAY');
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);
});
