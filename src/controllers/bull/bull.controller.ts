import IControllerBase from "../../interfaces/IControllerBase.interface";
import Bull = require("bull");
import * as express from "express";
import {
  getSwingStocks,

  getIntradayStocks,
  deleteIntradayStocks,
  insertNotification,
  getDetails,
} from "../../controllers/home/swing/swing.service";
import moment = require("moment");

import Subscription from "../../models/subscription";
import { sockets } from "../../app";
import ExpoPushToken from "../../models/ExpoPushToken";
import axios from 'axios';


const webpush = require("web-push");



const testData = {
  "highestHigh": {
    "highest": 1443.9,
    "indexNo": 34
  },
  "lowestLow": {
    "lowest": 940.8,
    "indexNo": 15
  },
  "high": {
    "highest": 1105,
    "indexNo": 22
  },
  "low": {
    "lowest": 990,
    "indexNo": 24
  },
  "secondTry": {
    "bit": false,
    "priceActionLength": 19,
    "priceActionSecondLength": 0
  },
  "trendLine": [
    940.8,
    985.325,
    985.6875,
    1005.9875,
    1026.225,
    1027.3375,
    1048.1125,
    1105,
    1064.0749999999998,
    990,
    1004.3,
    1014.9749999999999,
    1053.325,
    1088.9,
    1091.45,
    1114.9375,
    1181.8,
    1257.775,
    1374.325,
    1443.9,
    1340,
    1287,
    1325,
    1315,
    1300,
    1285,
    1380
  ],
  "_id": "5eec8ce5cf811e0017933b5a",
  "createDt": "2020-06-19T10:01:09.000Z",
  "instrument": "1378561",
  "goodOne": false,
  "avgHeight": 36.78809523809524,
  "lastHeight": 90.59999999999991,
  "trend": "UP",
  "valid": true,
  "symbol": "HDFCBANK",
  "avgCandelSize": 131.1,
  "todayCandelSize": 325.8,
  "allowedCandelSize": 91.77,
  "lastCandelIsGreen": true,
  "currentPrice": 1367.8,
  "type": "intraday",
  "__v": 0,
  tradeInfo:{
    orderPrice:1445,sl1:1400,target:1500
  },

};


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

      this.dailyEveningQueue.process(async () => {
        console.log("process dailyEveningQueue started");
        await deleteIntradayStocks();
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
          if (insertNotification(d)) {
            for (let socket of sockets) {
              socket.emit("FromAPI", d);
            }

            pushOnApp(d)

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
      const stocks = await getIntradayStocks();
      res.send(stocks);
    });
    this.router.get("/intraday/delete", async (req, res) => {
      const response = await deleteIntradayStocks();
      res.send(response);
    });


    this.router.get("/intradayStocks", async (req, res) => {
      const stocks = await this.getStocks("intraday");

      res.send(stocks);
    });



    this.router.get("/intradayTest", async (req, res) => {
    
      const stocks = await getDetails("BPCL","intraday");

      res.send(stocks);
    });

    this.router.get("/push", async (req, res) => {
      const payload = JSON.stringify({
        title: "test",
        body: "This push is from Manual Push",
        image: "https://source.unsplash.com/random/300×300",
        url: "https://youtube.com",
      });

      
      for (let socket of sockets) {
        socket.emit("FromAPI", testData);
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

    this.router.post("/registerPush", async (req, res) => {

      const {expoPushToken:token} = req.body;
      const exists = await ExpoPushToken.findOne({
        token
      }).exec();

      if (!exists) {
        const sub = new ExpoPushToken({token});
        sub.save().then((x) => console.log("New Expo Token added."));
      }

      res.status(201).json({});

    });


    this.router.get("/pushOnApp", async (req, res) => {

      
      await pushOnApp(testData);
        res.status(201).json({});
        // const response = await fetch('https://exp.host/--/api/v2/push/send', {
        //   method: 'POST',
        //   headers: {
        //     Accept: 'application/json',
        //     'Accept-encoding': 'gzip, deflate',
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify(message),
        // });

      });
    
    }
  }


export default BullController;


const  pushOnApp=async(data?:any)=>{
  const tokens :any= await ExpoPushToken.find();
    for (let sub of tokens) {


      
      let message = {
        to: sub.token,
        sound: 'default',
        title: 'Original Title',
        body:  'And here is the body!',
        data:{data:'Laxmikant'},
        _displayInForeground: true,
      };
      if(data){
         message = {
          to: sub.token,
          sound: 'default',
          title:`${data.symbol} STOCK UPDATE`,
          body:  `${data.symbol} created ${data.trend.toLowerCase()} trend`,
          data:{data},
          _displayInForeground: true,
        };  
      }


      console.log(message);
       await axios.post('https://exp.host/--/api/v2/push/send',
      JSON.stringify(message),{
        headers:{
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        }
      }
      ).catch(x=>{
        console.log('Could not send the notification',x)
      })
}
}
