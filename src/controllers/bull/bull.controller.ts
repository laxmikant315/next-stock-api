import IControllerBase from "../../interfaces/IControllerBase.interface";
import Bull = require("bull");
import * as express from "express";
import {
  getSwingStocks,
  getDailyVolatilitedStocks,
  getNifty100Stocks,
  getIntradayStocks,
  deleteIntradayStocks,
} from "../../controllers/home/swing/swing.service";
import moment = require("moment");

import * as mongoose from "mongoose";
import Notification from "../../models/notifications";
import Subscription from "../../models/subscription";
import { sockets } from "../../app";

const webpush = require("web-push");

class BullController implements IControllerBase {
  public router = express.Router();
  REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  cronSwing = process.env.CRON_SWING_TIME;
  cronIntraday = process.env.CRON_INTRADAY_TIME;

  swingQueue = new Bull("swing-queue", this.REDIS_URL);
  intradayQueue = new Bull("intraday-queue", this.REDIS_URL);
  timeQueue = new Bull("time-queue", this.REDIS_URL);

  dailyQueue = new Bull("daily-queue", this.REDIS_URL);

  dailyEveningQueue = new Bull("daily-eveing-queue", this.REDIS_URL);

  publicVapidKey = process.env.PUBLIC_VAPID_KEY;
  privateVapidKey = process.env.PRIVATE_VAPID_KEY;

  todaysIntradayStock;
  constructor() {
    try {
      this.initRoutes();
      this.create();

      // Replace with your email
      webpush.setVapidDetails(
        "mailto:laxmikantphadke@gmail.com",
        this.publicVapidKey,
        this.privateVapidKey
      );

      // deleteIntradayStocks()
      // getIntradayStocks();

      setTimeout(() => {
        // this.getStocks("swing");
      }, 30000);
      // this.getStocks("intraday");
      //  this.insertNotification({symbol:"LAKSH",trend:"UP",goodOne:true,valid:true,avgCandelSize:12,allowedCandelSize:10,todayCandelSize:3,highestHigh:{index:50,highest:210}, lowestLow:{index:10,lowest:100}, high:{index:20,highest:170}, low:{index:35,lowest:150}});

      this.dailyQueue.process(() => {
        getIntradayStocks();
      });

      this.dailyEveningQueue.process(() => {
        deleteIntradayStocks();
      });

      this.timeQueue.process((job) => {
        console.log(moment().format());
      });

      this.swingQueue.process(async (job) => {
        console.log("process started", job.data);
        return this.getStocks("swing");
      });

      this.intradayQueue.process(async (job) => {
        console.log("Intraday job started", job.data);
        return this.getStocks("intraday");
      });

      this.swingQueue.on("completed", (job, result) => {
        console.log(
          `Cron Job completed with result on ${
            this.cronSwing
          } , result=> ${JSON.stringify(result, null, 2)}`
        );
      });
    } catch (error) {
      console.log(error);
    }
  }

  async insertNotification(notification) {
    // Notification.find(x=>x.)
    const today = moment();
    let allow = false;
    if (notification.type === "swing") {
      const stock = await Notification.findOne({
        createDt: {
          $gte: today.startOf("day").toDate(),
          $lt: today.endOf("day").toDate(),
        },
        symbol: notification.symbol,
      });
      if (!stock) {
        allow = true;
      }
    } else {
      allow = true;
    }

    if (allow) {
      const notificationObj = new Notification({
        _id: mongoose.Types.ObjectId(),
        createDt: moment().format(),
        ...notification,
      });
      await notificationObj.save().catch((error) => console.log(error));
      console.log("Document inserted");
      return true;
    }
  }

  async getStocks(type: string) {
    try {
      const data = await getSwingStocks(type);
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
          d.type = type;
          // if (d.goodOne) {
          if (this.insertNotification(d)) {

            for (let socket of sockets) {
              socket.emit("FromAPI", d);
            }

            const payload = JSON.stringify({
              title: "Stock Update",
              body: `${d.symbol} created ${d.trend.toLowerCase()} trend`,
            });

            const subscriptions = await Subscription.find();
            if (subscriptions) {
              for (let sub of subscriptions) {
                webpush.sendNotification(sub, payload).catch((error) => {
                  console.error(error.stack);
                });
              }
            }
          }

          // }
        }
      }

      return data;
    } catch (error) {
      console.log(error.response.data.message);
    }
  }
  async create() {
    await this.swingQueue.add(
      {},
      {
        repeat: { cron: this.cronSwing },
      }
    );
    await this.timeQueue.add(
      {
        data: "Time Print",
      },
      {
        repeat: { every: 60000 },
      }
    );

    await this.intradayQueue.add(
      {},
      {
        repeat: { cron: this.cronIntraday },
      }
    );

    await this.dailyQueue.add(
      {},
      {
        repeat: { cron: process.env.CRON_DAILY },
      }
    );
    await this.dailyEveningQueue.add(
      {},
      {
        repeat: { cron: process.env.CRON_DAILY_EVENING },
      }
    );

    console.log("Jobs Created");
  }

  initRoutes() {
    this.router.get("/swing", async (req, res) => {
      res.send(await this.getStocks("swing"));
    });
    this.router.get("/intraday", async (req, res) => {
      const stocks=  await getIntradayStocks()
      res.send(stocks);
    });
    
    this.router.get("/push", async (req, res) => {
      const payload = JSON.stringify({
        title: "test",
        body: "This push is from Manual Push",
        image: "https://source.unsplash.com/random/300×300",
        url: "https://youtube.com",
      });

      const test = {
        createDt: {
          $date: "2020-05-10T10:18:34.000Z",
        },
        instrument: "79873",
        goodOne: true,
        avgHeight: 13.495945945945943,
        lastHeight: 10.899999999999977,
        trend: "DOWN",
        valid: true,
        symbol: "HDFC",
        avgCandelSize: 29.31,
        todayCandelSize: 1.9,
        allowedCandelSize: 20.52,
        highestHigh: {
          highest: 494.9,
          indexNo: 0,
        },
        lowestLow: {
          lowest: 254,
          indexNo: 15,
        },
        high: {
          highest: 331.95,
          indexNo: 11,
        },
        low: {
          lowest: 284.85,
          indexNo: 8,
        },
        lastCandelIsGreen: false,
        currentPrice: 366.1,
        type: "swing",
        __v: 0,
      };
      for (let socket of sockets) {
        socket.emit("FromAPI", test);
      }

      const subscriptions = await Subscription.find();
      for (let sub of subscriptions) {
        webpush.sendNotification(sub, payload).catch((error) => {
          console.error(error.stack);
        });

        console.log("Test Notification Pushed.", payload);
      }

      res.end("Pushed");
    });

    this.router.post("/subscribe", async (req, res) => {
      const subscription = req.body;

      const exists = await Subscription.findOne({
        "keys.auth": subscription.keys.auth,
        "keys.p256dh": subscription.keys.p256dh,
      }).exec();
      // const exists = this.subscriptionMain.find(
      //   (x) =>
      //     x.keys.auth === subscription.keys.auth &&
      //     x.keys.p256dh === subscription.keys.p256dh
      // );
      if (!exists) {
        const sub = new Subscription(subscription);
        sub.save().then((x) => console.log("New Subscription added."));
      }

      res.status(201).json({});
      // const payload = JSON.stringify({
      //   title: "test",
      //   body: "This push is from Test",
      // });

      // console.log(subscription);

      // webpush.sendNotification(subscription, payload).catch((error) => {
      //   console.error(error.stack);
      // });

      // console.log("Test Pushed.", payload);
    });
  }
}

export default BullController;
