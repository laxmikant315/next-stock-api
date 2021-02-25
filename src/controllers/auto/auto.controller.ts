import IControllerBase from "../../interfaces/IControllerBase.interface";
import Bull = require("bull");
import * as express from "express";
import { getStocks } from "./auto.helper";

const webpush = require("web-push");

class AutoController implements IControllerBase {
  public router = express.Router();
  REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  cronSwing = process.env.CRON_SWING_TIME;

  swingQueue = new Bull("swing-queue", this.REDIS_URL);

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

      this.swingQueue.process(async (job) => {
        console.log("process started", job.data);
        return getStocks("swing");
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

  async create() {
    await this.swingQueue.add(
      {},
      {
        repeat: { cron: this.cronSwing },
      }
    );
    console.log("Jobs Created");
  }

  initRoutes() {
    this.router.get("/swg", async (req, res) => {
      res.send(await getStocks());
    });
  }
}

export default AutoController;
