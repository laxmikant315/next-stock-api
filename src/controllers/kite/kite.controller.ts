import * as express from "express";
import { Request, Response } from "express";
import IControllerBase from "interfaces/IControllerBase.interface";

import { placeOrder, addToCronToWatch, checkOrder } from "./kite.service";
import { Console } from "console";
import Bull = require("bull");
import { create } from "domain";

class KiteController implements IControllerBase {
 
  public path = "/kite";
  public router = express.Router();

 
  REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  orderWatch = new Bull("order-watch", this.REDIS_URL);
  sub: Bull.Job<any>;
  
  constructor() {
    this.initRoutes();

    this.create()


    this.orderWatch.process(async (job) => {
      console.log("Intraday job started", job.data);
      return await checkOrder()
    });


  }


  public initRoutes() {
    this.router.get(`${this.path}/`, this.index);
    this.router.post(`${this.path}/order`, this.order);
   
  }

  index = (req: Request, res: Response) => {
    
  

    res.send('Working');
  };


  async create() {
    await this.orderWatch.add(
      {},
      {
        repeat: { cron: "*/1 10-13 * * *" },
      }
    );

   await this.orderWatch.pause();

  }
  

  order = (req: Request, res: Response) => {
   
    const {symbol,transaction_type,quantity,price,sl,target} = req.body;

    const response= placeOrder(symbol,transaction_type,quantity,price)

    if(response){
        console.log('Start Watching to Order Position');
        addToCronToWatch(symbol,transaction_type,quantity,sl,target)

        res.send(response);
    }
    res.send('ERROR');
  };
}

export default KiteController;
