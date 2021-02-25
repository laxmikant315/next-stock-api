import {
  getSwingStocks,
  insertNotification,
} from "../../controllers/home/swing/swing.service";

import { sockets } from "../../app";

import { db } from "../../server";
import axios from "axios";

const webpush = require("web-push");

const pushOnApp = async ({ title, body, data }: any) => {
  const tokens: any = await db("expoPushTokens").select();
  for (let sub of tokens) {
    let message = {
      to: sub.token,
      sound: "default",
      title: "Original Title",
      body: "And here is the body!",
      data: { data: "Laxmikant" },
      _displayInForeground: true,
    };

    message = {
      to: sub.token,
      sound: "default",
      title,
      body,
      data: { data },
      _displayInForeground: true,
    };

    console.log(message);
    await axios
      .post("https://exp.host/--/api/v2/push/send", JSON.stringify(message), {
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
      })
      .catch((x) => {
        console.log("Could not send the notification", x);
      });
  }
};

const getStocks = async (type: string = "swing") => {
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

          await pushOnApp({
            title: `${d.symbol} STOCK UPDATE`,
            body: `${d.symbol} created ${d.trend.toLowerCase()} trend`,
            data: d,
          });

          const payload = JSON.stringify({
            title: "Stock Update",
            body: `${d.symbol} created ${d.trend.toLowerCase()} trend`,
          });

          // const subscriptions = await Subscription.find();
          const subscriptions = await db("subscriptions").select();
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
    console.log(error);
  }
};
export { getStocks };
