import axios from 'axios';

import { env } from "process";
const qs = require('querystring')

export const placeOrder =  (tradingsymbol:string,transaction_type:string,quantity:number,price:number)=>{

  const requestBody = {
    exchange:'NSE',
    tradingsymbol,
    transaction_type,
    order_type:'SL-M',
    quantity,
    price,
    product:'MIS',
    validity:'DAY',
    disclosed_quantity:quantity,
    trigger_price:price,
    squareoff:0,
    stoploss:0,
    trailing_stoploss:0,
    variety:'regular',
    user_id:''
  }

  const config = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'authorization':env.accessToken
    }
  }
  

  return  axios.post(
      `${env.zerodhaUrl}oms/orders/regular`,
      qs.stringify(requestBody), config
    )
    .then((x) => x.data.data)
    .catch((e) => console.log(e.response.data.message));

}

export const addToCronToWatch=async(symbol,transaction_type,quantity,sl,target)=>{
  const orders = await checkOrder();

  if(orders && orders.length){

    if('Order is executed & Not in system'){
      let oppTransaction = "BUY"
      if(transaction_type==="BUY"){
        oppTransaction="SELL"
      }
      //addStoploss();
      placeOrder(symbol,oppTransaction,quantity,sl);

      //addTarget();
      placeOrder(symbol,oppTransaction,quantity,target);
     
    }

  }
}

export const checkOrder =  ()=>{

  const config = {
    headers: {
      'authorization':env.accessToken
    }
  }
  

  return  axios.get(
      `${env.zerodhaUrl}oms/orders`
      , config
    )
    .then((x) => x.data.data)
    .catch((e) => console.log(e.response.data.message));

}