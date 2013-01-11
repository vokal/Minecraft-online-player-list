var express = require('express');

var app = express(express.logger());
app.use(express.bodyParser());

app.configure(function() {
    app.use(express.static(__dirname + '/static'));
});

var players = [];

app.get('/', function(req, res) {
    res.render('index.jade', {
        players: players
    });
});

app.post('/update', function(req, res) {
    console.log(req.body);
    players = req.body
    res.send('OKAY');
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
    console.log("Listening on " + port);
});
