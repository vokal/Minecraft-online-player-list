var express = require('express');

var app = express(express.logger());
var server = require('http').createServer(app)
var io = require('socket.io').listen(server);

app.use(express.bodyParser());

app.configure(function() {
    app.use(express.static(__dirname + '/static'));
});

var players = [];

app.get('/', function(req, res) {
    res.render('index.jade', {});
});

app.post('/update', function(req, res) {
    console.log(req.body);
    players = req.body
    io.sockets.emit('players', { players: players });
    res.send('OKAY');
});

var port = process.env.PORT || 5000;
server.listen(port, function() {
    console.log("Listening on " + port);
});

io.configure(function () { 
    io.set("transports", ["xhr-polling"]); 
    io.set("polling duration", 10); 
});

io.sockets.on('connection', function (socket) {
    socket.emit('players', { players: players });
});
