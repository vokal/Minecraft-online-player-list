var socket = io.connect(window.location.hostname);

socket.on('players', function(data) {
    $('table#player-list').html(ich.header_row({}));

    for (var i in data.players) {
        console.log(data.players[i]);

        data.players[i].x = data.players[i].x.toFixed(2);
        data.players[i].y = data.players[i].y.toFixed(2);
        data.players[i].z = data.players[i].z.toFixed(2);

        $('table#player-list').append(ich.player_row(data.players[i]));
    }
});
