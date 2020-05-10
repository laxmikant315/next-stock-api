import * as express from "express";
import { Application } from "express";
// import mongoose from 'mongoose'
import * as  http from 'http'
import * as socketIo from "socket.io";
const mongoose = require("mongoose");
import { env } from "process";

class App {
    
  
  public app: Application;
  public port: number;
  public io: socketIo.Server;

  public getApiAndEmit = (socket)=>{
    const response = new Date();
    // Emitting a new message. Will be consumed by the client
    socket.emit("FromAPI", response);
  
  };
  constructor(appInit: { port: number; middleWares: any; controllers: any }) {
    this.app = express();
    var allowedOrigins = "http://localhost:* https://next-5.herokuapp.com:*";
    const server = http.createServer(this.app);
    this.io = socketIo(server);
    this.io.origins(allowedOrigins)
    let interval;
 
    this.io.on("connection", (socket) => {
      console.log("New client connected");
      if (interval) {
        clearInterval(interval);
      }
      interval = setInterval(() => this.getApiAndEmit(socket), 1000);
      socket.on("disconnect", () => {
        console.log("Client disconnected");
        clearInterval(interval);
      });
    });

    this.port = appInit.port;

    this.middlewares(appInit.middleWares);
    this.routes(appInit.controllers);
    this.assets();
    this.template();
  }

  private async middlewares(middleWares: {
    forEach: (arg0: (middleWare: any) => void) => void;
  }) {
    middleWares.forEach((middleWare) => {
      this.app.use(middleWare);
    });

    console.log("Database is connecting.");

    await mongoose.connect(env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("Database connected.");
  }

  private routes(controllers: {
    forEach: (arg0: (controller: any) => void) => void;
  }) {
    controllers.forEach((controller) => {
      this.app.use("/", controller.router);
    });
  }

  private assets() {
    this.app.use(express.static("public"));
    this.app.use(express.static("views"));
  }

  private template() {
    this.app.set("view engine", "pug");
  }

  public listen() {
    const server = this.app.listen(this.port, () => {
      console.log(`App listening on the http://localhost:${this.port}`);
    });
    server.timeout = 10000000;
  }
}

export default App;
