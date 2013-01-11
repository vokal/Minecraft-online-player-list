var socket = io.connect(window.location.hostname);

socket.on('news', function (data) {
    console.log(data);
    socket.emit('my other event', { my: 'data' });
});

socket.on('players', function(data) {
    $('table#player-list').html(ich.header_row({}));

    for (var i in data.players) {
        console.log(data.players[i]);
        $('table#player-list').append(ich.player_row(data.players[i]));
    }
});
