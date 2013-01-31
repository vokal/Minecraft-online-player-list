var express = require('express');
var Db = require('mongodb').Db;
var Server = require('mongodb').Server;

var app = express(express.logger());
var server = require('http').createServer(app)
var io = require('socket.io').listen(server);

var mongo_uri = process.env.MONGO_ADDRESS || "localhost"
var mongo_port = process.env.MONGO_PORT || 27017;
var mongo_db = process.env.MONGO_DB || "mapserve";

var location_update_interval = process.env.UPDATE_INTERVAL || 120;

app.use(express.bodyParser());

app.configure(function() {
    app.use(express.static(__dirname + '/static'));
});

var mongo_server = new Server(mongo_uri, mongo_port, { autoreconnect: true })
var db = new Db(mongo_db, mongo_server, { native_parser:false, safe:false });

var location_update_counter = location_update_interval;

var players = {
    'players': [],
    'death_points': [],
};

app.get('/', function(req, res) {
    res.render('index.jade', {});
});

app.get('/locations', function(req, res) {
    res.json(players);
});

app.get('/locations/:player', function(req, res) {
    var name = req.param('player');

    var query = {'player': name};
    if (req.param('t')) {
        query['timestamp'] = {$gte: Number(req.param('t'))};
    }

    db.collection('player_locations', function(err, player_locations) {
        player_locations.find(query).toArray(function(err, pl) {
            res.json(pl);
        });
    });
});

app.get('/deathpoints/:player', function(req, res) {
    var name = req.param('player');

    var query = {'player': name};
    if (req.param('t')) {
        query['timestamp'] = {$gte: Number(req.param('t'))};
    }

    db.collection('deathpoint_locations', function(err, deathpoint_locations) {
        deathpoint_locations.find(query).toArray(function(err, dl) {
            res.json(dl);
        });
    });
});

app.get('/players', function(req, res) {
    var result = [];
    var threshold = 0;

    var last_known_location = function(player) {
        db.collection('player_locations', function(err, player_locations) {
            player_locations.find({'player': player}).sort({'timestamp':-1}).limit(1).toArray(function(err, p) {
                result.push(p[0]);

                if (result.length == threshold) {
                    res.json(result);
                }
            });
        });
    };

    db.collection('players', function(err, players) {
        players.find({}).toArray(function(err, pl) {
            threshold = pl.length;

            for (var i in pl) {
                last_known_location(pl[i].player);
            }
        });
    });
});

app.post('/update', function(req, res) {
    players = req.body
    io.sockets.emit('players', players);
    res.send('OKAY');
});

function updateRecords(data) {
    db.collection('players', function(err, players) {
        player_list = []
        for (var i in data.players) {
            player_list.push({
                player: data.players[i].player,
            });
        }
        
        players.ensureIndex({player: 1}, {unique:true}, function(err, indexName) {
            players.insert(player_list);
        });
    });

    db.collection('player_locations', function(err, player_locations) {
        player_locations.insert(data.players);
    });

    db.collection('deathpoint_locations', function(err, deathpoint_locations) {
        deathpoint_locations.ensureIndex({timestamp: 1}, {unique:true}, function(err, indexName) {
            deathpoint_locations.insert(data.death_points);
        });
    });
}

io.set('log level', 1);

io.sockets.on('connection', function (socket) {
    socket.emit('players', players);

    socket.on('update', function (data) {
        players = data;
        io.sockets.emit('players', data);

        if (location_update_counter == 0) {
            console.log('Location update -> ');
            updateRecords(data);
            location_update_counter = location_update_interval;
        } else {
            location_update_counter--;
        }
    });
});

// MongoHQ can be slow to connect, so we need to hold off on starting
// the webserver until that connection is established
db.open(function(err, db) {
    if (err) {
        console.log(err);
        return;
    }

    var username = process.env.MONGO_USERNAME || '';
    var password = process.env.MONGO_PASSWORD || '';

    if (username && password) {
        db.authenticate(username, password, function(err, conn) {
            if (err) {
                console.log(err);
                return;
            }

            console.log("Database opened");

            runserver();
        });
    } else {
        runserver();
    }
});

var runserver = function() {
    db.collection('players', {safe:true}, function(err, collection) {
        if (err) {
            console.log("The 'players' collection doesn't exist.");
        }
    });

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

    // Now that we've connected to the database, let's start the webserver
    var port = process.env.PORT || 5000;
    server.listen(port, function() {
        console.log("Listening on " + port);
    });
}
