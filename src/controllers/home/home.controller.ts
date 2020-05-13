import * as express from "express";
import { Request, Response } from "express";
import IControllerBase from "interfaces/IControllerBase.interface";
import axios from "axios";
import Notification from '../../models/notifications'

import {
  getInsruments,
  getVolumeStocks,
  getHistorical,
  getSwingStocks,
} from "./swing/swing.service";
class HomeController implements IControllerBase {
  public path = "/";
  public router = express.Router();

  constructor() {
    this.initRoutes();
    // this.connectApp();
    this.startKeepAlive();

   

  }
  connectApp() {
    axios
      .get("https://next-stock-31.herokuapp.com")
      .then((x) => {
        console.log("app connected", x);
      })
      .catch((e) => {
        console.log("app disconnected", e);
      });
  }
  startKeepAlive() {
    try {
      setInterval(() => {
        this.connectApp();
      }, 20 * 60 * 1000); //every 20 mins
    } catch (error) {
      console.log(error);
    }
  }

  public initRoutes() {
     this.router.get("/", this.index);
    this.router.get("/notifications", this.notifications);
    this.router.get(
      "/api/swing/:trend",
      async (req: Request, res: Response) => {
        var trend = req.params.trend.toString();
        const payload = JSON.stringify({
          title: "Laxmikant Phadke",
          body: "This push is from API",
        });

        
        res.send(await getSwingStocks(trend));
      }
    );
  }


  notifications = async (req: Request, res: Response) => {

    const type= req.query.type;
    const query:any={};
    if(type){
      query.type=type
    }
    Notification.find(query).sort('-createDt').then(x=>res.send(x));
    
  }
  index =  (req: Request, res: Response) => {
    // const todos = await (
    //   await axios.get("https://jsonplaceholder.typicode.com/todos")
    // ).data;

    // const db = await MongoClient.connect(process.env.MONGO_URL);

    // const dbo = db.db("heroku_nmpf1dzg");
    // let notifications = await dbo.collection("notifications").find().toArray() ;
   
    // db.close();
    // console.log(todos)
    // const todos = [
    //     {
    //       id: 1,
    //       title: "Ali",
    //     },
    //     {
    //       id: 2,
    //       title: "Can",
    //     },
    //     {
    //       id: 3,
    //       title: "Ahmet",
    //     },
    //   ];
    const users = [
      {
        id: 1,
        name: "Ali",
      },
      {
        id: 2,
        name: "Can",
      },
      {
        id: 3,
        name: "Ahmet",
      },
    ];

    res.render("home/index", { users  });
  };
}

export default HomeController;
