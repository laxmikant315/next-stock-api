import * as express from "express";
import { Request, Response } from "express";
import IControllerBase from "interfaces/IControllerBase.interface";
import Order from "../../models/order";

import {
  placeOrder,
  addToCronToWatch,
  watchOnOrder,
  cancelOrder,
} from "./kite.service";

class KiteController implements IControllerBase {
  public path = "/kite";
  public router = express.Router();

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

    console.log('Req Body',req.body);
    const { symbol, transaction_type, quantity, price, sl, target } = req.body;
    console.log('symbol',symbol)
    const response = await placeOrder(
      symbol,
      transaction_type,
      quantity,
      price,
      "SL-M",
      "order"
    );

    if (response) {
      console.log("Start Watching to Order Position");

      await watchOnOrder(
        "order-queue",
        {
          symbol,
          transaction_type,
          quantity,
          sl,
          target,
          orderNo: response.orderNo,
        },
        async (job, timeQueue) => {
          console.log("Trade watch started", job.data);
          const {
            symbol,
            transaction_type,
            quantity,
            sl,
            target,
            orderNo,
          } = job.data;
          const res = await addToCronToWatch(
            symbol,
            transaction_type,
            quantity,
            sl,
            target,
            orderNo
          );
          if (res === "CLOSE") {
            console.log("Trade watch closed", job.data);

            let oppTransaction = "BUY";
            if (transaction_type === "BUY") {
              oppTransaction = "SELL";
            }

            //addStoploss();
            const response = await placeOrder(
              symbol,
              oppTransaction,
              quantity,
              sl,
              "SL-M",
              "sl"
            );

            let slQueue, targetQueue;
            let slOrderNo = response.orderNo;

            await watchOnOrder(
              "order-sl-queue",
              {
                symbol,
                transaction_type: oppTransaction,
                orderNo: response.orderNo,
                quantity,
                sl,
                target,
              },
              async (job, queue) => {
                slQueue= queue;
                console.log("Trade SL watch started", job.data);
                const {
                  symbol,
                  transaction_type,
                  quantity,
                  sl,
                  target,
                  orderNo,
                } = job.data;
                const res = await addToCronToWatch(
                  symbol,
                  transaction_type,
                  quantity,
                  sl,
                  target,
                  orderNo
                );
                if (res === "CLOSE") {
                  console.log("Stoploss hitted");
                  console.log("Trade SL & Target watch closed", job.data);

                  queue.close();
                  targetQueue.close();

                
                  await cancelOrder(targetOrderNo).then(async (x) => {
                    console.log("Target Order Cancelled", x);

                    const orderInMyBag = await Order.findOne({
                      symbol,
                      orderNo: targetOrderNo,
                    }).exec();

                    await orderInMyBag.update({ status: "CANCELLED" }, () => {
                      console.log("Target Order document updated");
                    });

                  });
                }
                return res;
              }
            );

            console.log("Stoploss added.", response);

            //addTarget();
            const response1 = await placeOrder(
              symbol,
              oppTransaction,
              quantity,
              target,
              "LIMIT",
              "target"
            );
            const targetOrderNo = response1.orderNo;
            await watchOnOrder(
              "order-target-queue",
              {
                symbol,
                transaction_type: oppTransaction,
                orderNo: response1.orderNo,
                quantity,
                sl,
                target,
              },
              async (job, queue) => {
                targetQueue = queue;
                targetOrderNo
                console.log("Trade Target watch started", job.data);
                const {
                  symbol,
                  transaction_type,
                  quantity,
                  sl,
                  target,
                  orderNo,
                } = job.data;
                const res = await addToCronToWatch(
                  symbol,
                  transaction_type,
                  quantity,
                  sl,
                  target,
                  orderNo
                );
                if (res === "CLOSE") {
                  console.log("Target hitted");
                  console.log("Trade SL & Target watch closed", job.data);
                  queue.close();
                  slQueue.close();

                  await cancelOrder(slOrderNo).then(async (x) => {
                    console.log("SL Order Cancelled", x);
                    const orderInMyBag = await Order.findOne({
                      symbol,
                      orderNo: slOrderNo,
                    }).exec();
                    await orderInMyBag.update({ status: "CANCELLED" }, () => {
                      console.log("SL Order document updated");
                    });
                  });
                }
                return res;
              }
            );

            console.log("target added.", response);

            timeQueue.close();
          }
          return res;
        }
      );

      res.send(response);
    } else {
      res.send("ERROR");
    }
  };
}

export default KiteController;
