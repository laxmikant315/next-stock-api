import * as express from "express";
import { Request, Response } from "express";
import IControllerBase from "interfaces/IControllerBase.interface";

import { placeOrder, addToCronToWatch, checkOrder } from "./kite.service";
import { Console } from "console";
import Bull = require("bull");
import { create } from "domain";
import moment = require("moment");

class KiteController implements IControllerBase {
  public path = "/kite";
  public router = express.Router();

  REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

  timeQueue = new Bull("order-queue", this.REDIS_URL);
  constructor() {
    this.initRoutes();

    // this.orderWatch
    //   .add(
    //     {
    //       symbol: "AJS",
    //       transaction_type: "SELL",
    //       quantity: 12,
    //       sl: 10,
    //       target: 14,
    //     },
    //     {
    //       repeat: { every: 60000 },
    //     }
    //   )
    //   .then((x) => {
    //     console.log("Job added", x);
    //   });
  }

  public initRoutes() {
    this.router.get(`${this.path}/`, this.index);
    this.router.post(`${this.path}/order`, this.order);
  }

  index = (req: Request, res: Response) => {
    res.send("Working");
  };

  order = async (req: Request, res: Response) => {
    const { symbol, transaction_type, quantity, price, sl, target } = req.body;

    const response = placeOrder(
      symbol,
      transaction_type,
      quantity,
      price,
      "SL-M"
    );

    if (response) {
      console.log("Start Watching to Order Position");

      this.timeQueue
        .add(
          {
            symbol, transaction_type, quantity, sl, target
          },
          {
            repeat: { every: 60000 },
          }
        )
        .then((x) => {
          this.timeQueue.process(async (job) => {
            console.log("Trade watch started", job.data);
            const { symbol, transaction_type, quantity, sl, target } = job.data;
            return await addToCronToWatch(
              symbol,
              transaction_type,
              quantity,
              sl,
              target
            );
          });
        });

      res.send(response);
    }
    res.send("ERROR");
  };
}

export default KiteController;
