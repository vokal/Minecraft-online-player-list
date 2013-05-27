package main

import (
	"code.google.com/p/go.net/websocket"
	"encoding/json"
	"fmt"
	"github.com/scottferg/goat"
	"github.com/scottferg/mux"
	"labix.org/v2/mgo"
	"labix.org/v2/mgo/bson"
	"net/http"
	"os"
)

const (
	updateInterval = 120
)

var (
	g              *goat.Goat
	pool           *connectionPool
	db             *mgo.Database
	update_counter int
)

type socketConnection struct {
	socket   *websocket.Conn
	messages chan string
}

type mapPoint struct {
	Id        bson.ObjectId `json:"id" bson:"_id,omitempty"`
	Player    string        `json:"player"`
	Realm     string        `json:"realm"`
	Timestamp int           `json:"timestamp"`
	X         float64       `json:"x"`
	Y         float64       `json:"y"`
	Z         float64       `json:"z"`
}

type message struct {
	Type    string `json:"type"`
	Payload struct {
		Players     []mapPoint `json:"players"`
		DeathPoints []mapPoint `json:"death_points"`
	} `json:"payload"`
}

type connectionPool struct {
	pool       map[*socketConnection]bool
	register   chan *socketConnection
	unregister chan *socketConnection
	broadcast  chan string
}

func NewConnectionPool() *connectionPool {
	return &connectionPool{
		pool:       make(map[*socketConnection]bool),
		register:   make(chan *socketConnection),
		unregister: make(chan *socketConnection),
		broadcast:  make(chan string),
	}
}

func (c *connectionPool) run() {
	for {
		select {
		case sc := <-c.register:
			c.pool[sc] = true
		case sc := <-c.unregister:
			delete(c.pool, sc)
			close(sc.messages)
		case message := <-c.broadcast:
			for sc := range c.pool {
				sc.write(message)
			}
		}
	}
}

func (s *socketConnection) listen() {
	for {
		var raw string

		err := websocket.Message.Receive(s.socket, &raw)
		if err != nil {
			break
		}

		update_counter--
		if update_counter <= 0 {
			var m message
			_ = json.Unmarshal([]byte(raw), &m)
			updateRecords(m)

			update_counter = updateInterval
		}

		pool.broadcast <- raw
	}
}

func (s *socketConnection) write(message string) {
	err := websocket.Message.Send(s.socket, message)
	if err != nil {
		return
	}
}

func updateRecords(m message) (err error) {
	if len(m.Payload.Players) > 0 {
		c := db.C("player_locations")
		for _, v := range m.Payload.Players {
			err = c.Insert(v)
		}
	}

	if len(m.Payload.DeathPoints) > 0 {
		c := db.C("death_points")
		for _, v := range m.Payload.DeathPoints {
			err = c.Insert(v)
		}
	}

	return
}

func handleSocket(ws *websocket.Conn) {
	s := &socketConnection{
		socket: ws,
	}

	defer func() {
		if err := s.socket.Close(); err != nil {
			fmt.Println("Websocket could not be closed: ", err.Error())
		}
	}()

	pool.register <- s

	client := s.socket.Request().RemoteAddr
	fmt.Println("Client connected: ", client)

	s.listen()
}

func handlePlayerLocations(w http.ResponseWriter, r *http.Request, c *goat.Context) error {
	vars := mux.Vars(r)
	var points []mapPoint

	db := c.Database.C("player_locations")
	err := db.Find(bson.M{"player": vars["player"]}).All(&points)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return err
	}

	_ = json.NewEncoder(w).Encode(points)

	return nil
}

func handleDeathpoints(w http.ResponseWriter, r *http.Request, c *goat.Context) error {
	vars := mux.Vars(r)
	var points []mapPoint

	db := c.Database.C("death_points")
	err := db.Find(bson.M{"player": vars["player"]}).All(&points)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return err
	}

	_ = json.NewEncoder(w).Encode(points)

	return nil
}

func main() {
	g = goat.NewGoat()

	database := os.Getenv("MONGOHQ_URL")
	if database == "" {
		database = "localhost"
	}

	update_counter = updateInterval

	g.RegisterMiddleware(g.NewDatabaseMiddleware(database, "hotdog_locations"))

	g.RegisterRoute("/deathpoints/{player}", "deathpoints", goat.GET, handleDeathpoints)
	g.RegisterRoute("/locations/{player}", "locations", goat.GET, handlePlayerLocations)
	g.RegisterRoute("/", "socket", goat.GET, websocket.Server{
		Handler: handleSocket,
	})

	db = g.CloneDB()

	pool = NewConnectionPool()
	go pool.run()

	g.ListenAndServe("5000")
}
