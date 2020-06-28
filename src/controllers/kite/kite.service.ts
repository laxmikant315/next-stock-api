import axios from "axios";

import { env } from "process";
import AppSetting from "../../models/app-settings";
import Bull = require("bull");
const qs = require("querystring");
import * as mongoose from "mongoose";
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";
import Order from "../../models/order";
import moment = require("moment");
import e = require("express");

const mockEnabled = process.env.MOCK_ENABLED || false;

export const placeOrder = async (
  tradingsymbol: string,
  transaction_type: string,
  quantity: number,
  price: number,
  order_type: string,
  myOrderType: string
) => {

  console.log('tradingsymbol1',tradingsymbol)

  const requestBody = {
    exchange: "NSE",
    tradingsymbol,
    transaction_type,
    order_type,
    quantity,
    price,
    product: "MIS",
    validity: "DAY",
    disclosed_quantity: quantity,
    trigger_price: price,
    squareoff: 0,
    stoploss: 0,
    trailing_stoploss: 0,
    variety: "regular",
    user_id: "",
  };

  const config = {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      authorization: env.accessToken,
    },
  };
  const db: any = await AppSetting.find({}).exec();

  let res;
  if (mockEnabled) {
    if (myOrderType === "order") {
      res = db[0].mock.order;
    } else if (myOrderType === "sl") {
      res = db[0].mock.orderSl;
    } else if (myOrderType === "target") {
      res = db[0].mock.orderTarget;
    }
  } else {
    res = await axios
      .post(
        `${env.zerodhaUrl}oms/orders/regular`,
        qs.stringify(requestBody),
        config
      )
      .then((x) => x.data.data)
      .catch((e) => console.log(e.response.data.message));
  }
  console.log('tradingsymbol2',tradingsymbol)
  if (res.status === "success") {

    const result = {
      symbol: tradingsymbol,
      orderNo: res.data.order_id,
      status: "PLACED",
      tradingsymbol,
      order_type,
    };

    const orderObj = new Order({
      createDt: moment().format(),
      _id: mongoose.Types.ObjectId(),
      ...result,
    });
    await orderObj
      .save()
      .catch((error) => console.log("Failed to save order", error));
    console.log("Order inserted in database");

    return result;
  }
};

export const watchOnOrder = async (
  name: string,
  data: {
    symbol: any;
    transaction_type: any;
    quantity: any;
    sl: any;
    target: any;
    orderNo: any;
  },
  callback: any
) => {
  const timeQueue = new Bull(name, REDIS_URL);
  await timeQueue
    .add(data, {
      repeat: { every: 60000 },
    })
    .then((x) => {
      timeQueue.process(async (job) => {
        return callback(job, timeQueue);
      });
    });
};
export const addToCronToWatch = async (
  symbol,
  transaction_type,
  quantity,
  sl,
  target,
  order_id
) => {
  const ordersRes = await checkOrder();

  if (
    ordersRes.status === "success" &&
    ordersRes.data &&
    ordersRes.data.length
  ) {
    const order = ordersRes.data.find(
      (x) =>
        x.tradingsymbol === symbol &&
        x.order_id === order_id &&
        x.placed_by === "BV7667"
    );

    const orderInMyBag = await Order.findOne({
      symbol,
      orderNo: order.order_id,
    }).exec();

    console.log(orderInMyBag);
    if (
      order.status === "COMPLETE" &&
      orderInMyBag.get("status") === "PLACED"
    ) {
      await orderInMyBag.update({ status: "COMPLETE" }, () => {
        console.log("Order updated");
      });
      return "CLOSE";
    }
  }
};

export const checkOrder = async () => {
  const config = {
    headers: {
      authorization: env.accessToken,
    },
  };

  if (mockEnabled) {
  const db: any = await AppSetting.find({}).exec();

  return db[0].mock.orders;
  }


  return axios
    .get(`${env.zerodhaUrl}oms/orders`, config)
    .then((x) => x.data.data)
    .catch((e) => console.log(e.response.data.message));
};

export const cancelOrder = async (order_id) => {
  const config = {
    headers: {
      authorization: env.accessToken,
    },
  };
  console.log("Order Cancelling called", order_id);

  if (mockEnabled) {
  const db: any = await AppSetting.find({}).exec();

  return db[0].mock.orderSl;
  }

  return axios
    .delete(`${env.zerodhaUrl}oms/orders/regular/${order_id}`, config)
    .then((x) => x.data.data)
    .catch((e) => console.log(e.response.data.message));
};
