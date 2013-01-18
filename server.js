var express = require('express');
var Db = require('mongodb').Db;
var Server = require('mongodb').Server;

var app = express(express.logger());
var server = require('http').createServer(app)
var io = require('socket.io').listen(server);

var mongo_uri = process.env.MONGO_ADDRESS || "localhost"
var mongo_port = process.env.MONGO_PORT || 27017;
var mongo_db = process.env.MONGO_DB || "mapserve";

var location_update_interval = process.env.UPDATE_INTERVAL || 10;

app.use(express.bodyParser());

app.configure(function() {
    app.use(express.static(__dirname + '/static'));
});

var mongo_server = new Server(mongo_uri, mongo_port, { autoreconnect: true })
var db = new Db(mongo_db, mongo_server, { native_parser:false });

var location_update_counter = location_update_interval;

db.open(function(err, db) {
    if (!err) {
        console.log("Connected to 'mapserve' database");
        db.collection('player_locations', {safe:true}, function(err, collection) {
            if (err) {
                console.log("The 'player_locations' collection doesn't exist.");
            }
        });

        db.collection('deathpoint_locations', {safe:true}, function(err, collection) {
            if (err) {
                console.log("The 'deathpoint_locations' collection doesn't exist.");
            }
        });
    }
});

var players = {
    'players': [],
    'death_points': [],
};

app.get('/', function(req, res) {
    res.render('index.jade', {});
});

app.get('/locations/:player', function(req, res) {
    var name = req.param('player');

    db.collection('player_locations', function(err, player_locations) {
        player_locations.find({'player': name}).toArray(function(err, pl) {
            db.collection('deathpoint_locations', function(err, deathpoint_locations) {
                deathpoint_locations.find({'player': name}).toArray(function(err, dl) {
                    res.json({
                        'player_locations': pl,
                        'deathpoint_locations': dl,
                    });
                });
            });
        });
    });
});

app.post('/update', function(req, res) {
    console.log(req.body);
    players = req.body
    io.sockets.emit('players', players);
    res.send('OKAY');
});

function updateLocations(data) {
    db.collection('player_locations', function(err, player_locations) {
        db.collection('deathpoint_locations', function(err, deathpoint_locations) {
            player_locations.insert(data.players);
            deathpoint_locations.insert(data.death_points);
        });
    });
}

io.sockets.on('connection', function (socket) {
    socket.emit('players', players);

    socket.on('update', function (data) {
        io.sockets.emit('players', data);

        if (location_update_counter == 0) {
            updateLocations(data);
            location_update_counter == location_update_interval;
        } else {
            location_update_counter--;
        }
    });
});

var port = process.env.PORT || 5000;
server.listen(port, function() {
    console.log("Listening on " + port);
});
