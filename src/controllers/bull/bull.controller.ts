import IControllerBase from "../../interfaces/IControllerBase.interface";
import Bull = require("bull");
import * as express from "express";
import { getSwingStocks } from "../../controllers/home/swing/swing.service";
import moment = require("moment");

import * as mongoose from "mongoose";
import Notification from "../../models/notifications";

const webpush = require("web-push");

class BullController implements IControllerBase {
  public router = express.Router();
  REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  cron = process.env.CRON_TIME || "22 18 * * *";
  myFirstQueue = new Bull("my-first-queue", this.REDIS_URL);
  myTimeQueue = new Bull("my-time-queue", this.REDIS_URL);
  public subscriptionMain: any = [];
  publicVapidKey = process.env.PUBLIC_VAPID_KEY;
  privateVapidKey = process.env.PRIVATE_VAPID_KEY;

  constructor() {
    try {
      this.initRoutes();
      this.create();
      console.log("Constructor");

      // Replace with your email
      webpush.setVapidDetails(
        "mailto:laxmikantphadke@gmail.com",
        this.publicVapidKey,
        this.privateVapidKey
      );

      this.getStocks();
      //  this.insertNotification({symbol:"LAKSH",trend:"UP",goodOne:true,valid:true,avgCandelSize:12,allowedCandelSize:10,todayCandelSize:3,highestHigh:{index:50,highest:210}, lowestLow:{index:10,lowest:100}, high:{index:20,highest:170}, low:{index:35,lowest:150}});

      this.myTimeQueue.process((job) => {
        console.log(moment().format());
      });

      this.myFirstQueue.process(async (job) => {
        console.log("process started", job.data);
        return this.getStocks();
      });

      this.myFirstQueue.on("completed", (job, result) => {
        console.log(
          `Job completed with result  ${JSON.stringify(result, null, 2)}`
        );
      });
    } catch (error) {
      console.log(error);
    }
  }

  async insertNotification(notification) {
    // Notification.find(x=>x.)
    const today= moment();
    const stock =await Notification.findOne({
       createDt: {$gte: today.startOf('day').toDate(), $lt: today.endOf('day').toDate()},
      symbol: notification.symbol,
    });
    // console.log(stock)
    if(!stock){

      const notificationObj = new Notification({
        _id: mongoose.Types.ObjectId(),
        createDt: moment().format(),
        ...notification,
      });
      notificationObj
        .save()
        .then(() => console.log('Document inserted'))
        .catch((error) => console.log(error));
    }

  }

  async getStocks() {
    try {
      const data = await getSwingStocks("UP");
      // console.log("process end");
      //  await console.log(job.data);
      // console.log(data);

      // const data = [
      //   {goodOne:true,trend:'UP', symbol:'HDFC'},
      //   {goodOne:true,trend:'DOWN', symbol:'HDFCAMC'},
      //   {goodOne:true,trend:'UP', symbol:'TITAN'},
      //   {goodOne:true,trend:'DOWN', symbol:'SBI'},
      // ]
      if (data && data.length > 0) {
        for (let d of data) {
          if (d.goodOne) {
            this.insertNotification(d);

            const payload = JSON.stringify({
              title: "Stock Update",
              body: `${d.symbol} created ${d.trend.toLowerCase()} trend`,
            });

            if (this.subscriptionMain) {
              for(let sub of this.subscriptionMain){
              webpush
                .sendNotification(sub, payload)
                .catch((error) => {
                  console.error(error.stack);
                });
              }
            }
          }
        }
      }

      return data;
    } catch (error) {
      console.log(error.response.data.message);
    }
  }
  async create() {
    const job1 = await this.myFirstQueue.add(
      {
        trend: "DOWN",
      },
      {
        repeat: { cron: this.cron },
      }
    );
    const timeJob = await this.myTimeQueue.add(
      {
        data: "Time Print",
      },
      {
        repeat: { every: 60000 },
      }
    );

    console.log("Jobs Created");
  }

  initRoutes() {
    this.router.get("/push", async (req, res) => {
      const payload = JSON.stringify({
        title: "test",
        body: "This push is from Manual Push",
      });


      for(let sub of this.subscriptionMain){
        webpush
        .sendNotification(sub, payload)
        .catch((error) => {
          console.error(error.stack);
        });

      console.log("Test Notification Pushed.", payload);
      }
    
      res.end("Pushed");
    });

    this.router.post("/subscribe", async (req, res) => {
      const subscription = req.body;
      this.subscriptionMain.push(req.body);
      res.status(201).json({});
      const payload = JSON.stringify({
        title: "test",
        body: "This push is from Test",
      });

      console.log(subscription);

      webpush.sendNotification(subscription, payload).catch((error) => {
        console.error(error.stack);
      });

      console.log("Test Pushed.", payload);
    });
  }
}

export default BullController;
