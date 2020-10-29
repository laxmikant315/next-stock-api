import * as express from "express";
import { Request, Response } from "express";
import IControllerBase from "interfaces/IControllerBase.interface";
import axios from "axios";
import { env } from "process";
import {
  getSwingStocks,
} from "./swing/swing.service";
import { db } from "../../server";
class HomeController implements IControllerBase {
  public path = "/";
  public router = express.Router();

  constructor() {
    this.initRoutes();
    this.startKeepAlive();
  }
  connectApp() {
    axios
      .get("https://next-stock-31.herokuapp.com")
      .then((x) => {
        console.log("app connected");
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
    this.router.get("/appConfig", this.appConfig);
    this.router.get("/pg", this.getPg)



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
  appConfig(req: Request, res: Response) {

    const { intradayRiskAmount } = env;
    const config = {
      intradayRiskAmount: +intradayRiskAmount
    }
    res.send(config)

  }

  getPg(req: Request, res: Response) {

    db.transaction(trx => {
      trx("notifications").returning("*").insert({

        createDt: new Date(),
        instrument: "97281",
        goodOne: true,
        avgHeight: 19.897368421052636,
        lastHeight: 68.35000000000002,
        trend: "UP",
        valid: true,
        symbol: "BBTC",
        avgCandelSize: 105.46,
        todayCandelSize: 16,
        allowedCandelSize: 73.82,
        highestHigh: 987.6,
        highestHighIndex: 14,

        lowestLow: 675.35,
        lowestLowIndex: 0,
        high: 854.3,
        highIndex: 5,

        low: 771.1,
        lowIndex: 7,

        lastCandelIsGreen: true,
        currentPrice: 905,
        type: "swing"

      })
        .then(notifications => res.json(notifications))
        .then(trx.commit)
        .catch(trx.rollback)
    })
      .catch(err => {
        console.log(err);

        res.status(400).json('unable to register')
      })
  }
  notifications = async (req: Request, res: Response) => {
    const type = req.query.type;
    const limit: number | null = +req.query.limit || null;
    const skip = (+req.query.offSet * limit) | 0;

    const query: any = {};

    if (type) {
      query.type = type;
    }

    const data = await db.select().table('notifications').where({ type })
      .limit(limit,)
      .offset(skip)
      .orderBy("createDt", "desc");

    res.send({ data, hasMoreItems: data.length === limit })

  };


  index = (req: Request, res: Response) => {

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

    res.render("home/index", { users });
  };
}

export default HomeController;
