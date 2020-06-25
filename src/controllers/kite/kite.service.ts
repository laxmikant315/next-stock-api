import axios from "axios";

import { env } from "process";
const qs = require("querystring");

export const ordersInMyBag = [];

export const placeOrder = (
  tradingsymbol: string,
  transaction_type: string,
  quantity: number,
  price: number,
  order_type:string
) => {
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

  const result = {symbol:tradingsymbol,orderNo : "200622003973123", status :"PLACED", tradingsymbol,order_type}

  
  ordersInMyBag.push(result)
  return result

  return axios
    .post(
      `${env.zerodhaUrl}oms/orders/regular`,
      qs.stringify(requestBody),
      config
    )
    .then((x) => x.data.data)
    .catch((e) => console.log(e.response.data.message));
};

export const addToCronToWatch = async (
  symbol,
  transaction_type,
  quantity,
  sl,
  target
) => {
  const orders = await checkOrder();

  if (orders && orders.length) {
    const order = orders.find(
      (x) =>
        x.tradingsymbol === symbol &&
        x.order_id === "200622003973123" &&
        x.placed_by === "BV7667"
    );

 
    const orderInMyBag = ordersInMyBag.find((x) => x.symbol === symbol);
    if (order.status === "COMPLETE" && orderInMyBag.status === "PLACED") {
      orderInMyBag.status==="COMPLETE"

      console.log('orders11',order)

      let oppTransaction = "BUY";
      if (transaction_type === "BUY") {
        oppTransaction = "SELL";
      }
      //addStoploss();
      const response = await placeOrder(symbol, oppTransaction, quantity, sl,"SL-M");

      console.log('Stoploss added.')


      //addTarget();
      const response1 = await placeOrder(symbol, oppTransaction, quantity, target,"LIMIT");

      console.log('target added.')
    }
  }
};

export const checkOrder = () => {
  const config = {
    headers: {
      authorization: env.accessToken,
    },
  };

  return axios
    .get(`${env.zerodhaUrl}oms/orders`, config)
    .then((x) => x.data.data)
    .catch((e) => console.log(e.response.data.message));
};
