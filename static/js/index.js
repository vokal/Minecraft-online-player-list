//this is the connecton from the web page to the local node server
var socket = io.connect(window.location.hostname);

socket.on('players', function(data) {
    $('tbody#player-list').html('');

    for (var i in data.players) {
        data.players[i].x = data.players[i].x.toFixed(2);
        data.players[i].y = data.players[i].y.toFixed(2);
        data.players[i].z = data.players[i].z.toFixed(2);

        $('tbody#player-list').append(ich.player_row(data.players[i]));
    }
    
    $('tbody#death-list').html('');
    for (var i in data.death_points) {
    	data.death_points[i].x = data.death_points[i].x.toFixed(2);
    	data.death_points[i].y = data.death_points[i].y.toFixed(2);
    	data.death_points[i].z = data.death_points[i].z.toFixed(2);
        $('tbody#death-list').append(ich.player_row(data.death_points[i]));
    }

});
