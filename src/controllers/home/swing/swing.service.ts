import * as swingStocks from "./swing-stocks.json";
import * as csv from "async-csv";
import * as fs from "fs";
import path = require("path");
import * as instruments from "./instruments.json";

import axios from "axios";
import { env } from "process";
import * as moment from "moment";
import Notification from "../../../models/notifications";
import * as margins from "../swing/margin.json";
import * as nifty100 from "../swing/nifty100.json";

import * as volatility from "../swing/volatility.json";
var dataMain: any = [];

let todaysIntradayStock;
export const getNifty100Stocks = async () => {
    // .get('https://www.nseindia.com/content/indices/ind_nifty100list.csv')
  // return await axios.get("https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%20100").then(x=>x.data.data).catch(e=>console.log('Nifty 100 Failed',e));
  return nifty100.data
};
export const deleteIntradayStocks = async () => {
  todaysIntradayStock = [];
  await Notification.deleteMany({ type: "intraday" });
  console.log("Intraday stocks deleted");
};
export const getDailyVolatilitedStocks = async (dateNow: string) => {
  try {
    
 
  
  const obj = await axios
    // .get(`https://www.nseindia.com/archives/nsccl/volt/CMVOLT_${dateNow}.CSV`)
    .get(
      `https://archives.nseindia.com/archives/nsccl/volt/CMVOLT_${dateNow}.CSV`
    );
  console.log('VL DATA,',obj.data)
  // const data = this.fetchData();
  const data = await csv.parse(obj.data);

  
  return data;  
} catch (error) {
  console.log('Failed to load daily volatilited stocks.');

}
   
};

export const getVolumeStocks = async (interval = "5minute") => {
  let scan_clause =
    "%7B33619%7D+(+%5B+0+%5D+5+minute+volume+%3E+(+(+%5B+-1+%5D+5+minute+volume+%2B+%5B+-2+%5D+5+minute+volume+%2B+%5B+-3+%5D+5+minute+volume+)+%2F+3+)+*+2.5+)";
  if (interval === "day") {
    scan_clause =
      "(+%7B57960%7D+(+latest+volume+%3E+(+(+1+day+ago+volume+%2B+2+days+ago+volume+%2B+3+days+ago+volume+%2B+4+days+ago+volume+%2B+5+days+ago+volume+)+%2F+5+)+*+2+)+)+";
  }

  return await axios
    .post(
      "https://chartink.com/screener/process",
      // tslint:disable-next-line:max-line-length
      `scan_clause=${scan_clause}`,

      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "X-CSRF-TOKEN": env.chartintToken,
          // tslint:disable-next-line:object-literal-key-quotes

          Cookie: env.chartintCookie,
        },
      }
    )
    .then((x) => x.data.data)
    .catch((e) => console.log(e.response.data.message));
};

export const readCSV = async (filePath: string) => {
  try {
    // Read file from disk:
    const csvString = fs.readFileSync(path.join(__dirname, filePath), "utf-8");

    // Convert CSV string into rows:
    const data = await csv.parse(csvString);

    return data;
  } catch (error) {
    throw error;
  }
};

export const getInsruments = (symbol?) => {
  try {
    if (symbol) {
      const stock = (<any>instruments).find(
        (x) => x[2].toUpperCase() === symbol.toUpperCase() && x[11] === "NSE"
      );
      if (stock) {
        return stock[0];
      }
    }
    return instruments;
  } catch (error) {
    throw error;
  }
};

const getProper = async (symbol: string) => {
  // const instrumentToken = await kiteService.getInsruments(symbol);
  // const data = await zerodhaService.getHistorical(instrumentToken, "5minute", moment()
  //   .format('YYYY-MM-DD') + '+09:15:00');
  const data = dataMain.concat();

  const candels = [];
  let firstCandel = data[0].concat();
  firstCandel = fillCandelInfo(firstCandel);

  candels.push(firstCandel);

  for (let i = 0; i < data.length; i++) {
    const candel = data[i];
    const dataBetween = data.slice(firstCandel.indexNo, i + 1);
    if (dataBetween.length <= 2) {
      continue;
    }
    const lowest = getLowestCandel(dataBetween);

    if (candel[2] > lowest[3] + (candels[0][2] - lowest[3]) * 0.24) {
      candels.push(lowest);
    }
    if (candels[1]) {
      candels[1] = fillCandelInfo(candels[1]);
      const dataBetween1 = data.slice(candels[1].indexNo, i + 1);
      const highest = getHighestCandel(dataBetween1);
      if (candel[3] < highest[2] - (highest[2] - candels[1][3]) * 0.24) {
        candels.push(highest);
      }
    }
  }

  return candels;
};
const fillCandelInfo = (candel: any): any => {
  if (candel[4] > candel[1]) {
    candel.isGreen = true;
  } else {
    candel.isGreen = false;
  }
  candel.indexNo = dataMain.map((x) => x[0]).indexOf(candel[0]);

  return candel;
};
const getHighestCandel = (dataBetween: any) => {
  let candel = dataBetween[0];
  for (const item of dataBetween) {
    if (item[2] > candel[2]) {
      candel = item;
    }
  }
  return candel;
};
const getLowestCandel = (dataBetween: any) => {
  let candel = dataBetween[0];
  for (const item of dataBetween) {
    if (item[3] < candel[3]) {
      candel = item;
    }
  }
  return candel;
};

export const getHistorical = async (
  instrumentToken: any,
  interval = "5minute",
  from = moment().add(-1, "months").format("YYYY-MM-DD+HH:mm:ss"),
  to = moment().format("YYYY-MM-DD+HH:mm:ss")
) => {
  const url = `${env.zerodhaUrl}oms/instruments/historical/${instrumentToken}/${interval}?from=${from}&to=${to}`;

  return await axios
    .get(url, {
      headers: {
        authorization: env.accessToken,
      },
    })

    .then((x) => {
      return x.data.data.candles;
    })
    .catch((error) => {
      console.log(error.response.data.message);
      return null;
    });
};

const getPriceAction = async (
  instrumentToken: string,
  interval = "5minute"
) => {
  let from = "";
  if (interval === "5minute") {
    from = moment().format("YYYY-MM-DD") + "+09:15:00";
  } else if (interval === "day") {
    from = moment().add(-60, "days").format("YYYY-MM-DD") + "+09:15:00";
  }

  const data = await getHistorical(instrumentToken, interval, from);
  let avgHeight = 0;

  if (data) {
    let heightArr = [];
    for (let d of data) {
      const height = Math.abs(d[1] - d[4]);
      heightArr.push(height);
    }

    const totalHeight = heightArr.reduce((x, y) => x + y);
    avgHeight = totalHeight / data.length;
  }
  // const highestHigh = Math.max(...data.map(x => x[2]));

  const highestHigh = getHighestHigh(data);

  // const lowestLow = Math.min(...data.map(x => x[3]));
  const lowestLow = getLowestLow(data);

  const highLowLength = Math.abs(highestHigh.highest - lowestLow.lowest);

  // const highCandelIndex = data.indexOf(data.find(x => x[2] === highestHigh));

  // const lowCandelIndex = data.indexOf(data.find(x => x[3] === lowestLow));

  const totalCandels = Math.abs(highestHigh.indexNo - lowestLow.indexNo) + 1;
  const per60 = Math.round((totalCandels * 50) / 100);

  let dataFirst60, dataLast60;
  let goingUp = false;
  if (highestHigh.indexNo < lowestLow.indexNo) {
    dataFirst60 = data.slice(
      highestHigh.indexNo,
      highestHigh.indexNo + per60 + 1
    );
    dataLast60 = data.slice(lowestLow.indexNo - per60, lowestLow.indexNo + 1);
  } else {
    goingUp = true;
    dataFirst60 = data.slice(lowestLow.indexNo, lowestLow.indexNo + per60 + 1);
    dataLast60 = data.slice(
      highestHigh.indexNo - per60,
      highestHigh.indexNo + 1
    );
  }

  const latestCandel = data[data.length - 1];

  // const firstHigh = Math.max(...dataFirst60.map(x => x[2]));
  const firstHigh = getHighestHigh(
    dataFirst60,
    "FIRST",
    goingUp,
    goingUp ? lowestLow.indexNo : highestHigh.indexNo
  );
  // const firstLow = Math.min(...dataFirst60.map(x => x[3]));
  const firstLow = getLowestLow(
    dataFirst60,
    "FIRST",
    goingUp,
    goingUp ? lowestLow.indexNo : highestHigh.indexNo
  );

  // let lastHigh = Math.max(...dataLast60.map(x => x[2]));
  let lastHigh = getHighestHigh(
    dataLast60,
    "LAST",
    goingUp,
    goingUp ? highestHigh.indexNo : lowestLow.indexNo
  );
  // let lastLow = Math.min(...dataLast60.map(x => x[3]));
  let lastLow = getLowestLow(
    dataLast60,
    "LAST",
    goingUp,
    goingUp ? highestHigh.indexNo : lowestLow.indexNo
  );

  if (highestHigh.indexNo < lowestLow.indexNo) {
    // const firstLowCandelIndex = data.indexOf(data.find(x => x[3] === firstLow));
    const dataLast601 = data.slice(firstLow.indexNo + 1, lowestLow.indexNo);
    // lastHigh = Math.max(...dataLast601.map(x => x[2]));
    lastHigh = getHighestHigh(
      dataLast601,
      "MID",
      goingUp,
      goingUp ? firstLow.indexNo + 1 : lowestLow.indexNo
    );
  } else {
    // const firstHighCandelIndex = data.indexOf(data.find(x => x[2] === firstHigh));

    const dataLast601 = data.slice(firstHigh.indexNo + 1, highestHigh.indexNo);
    // lastLow = Math.min(...dataLast601.map(x => x[3]));
    lastLow = getLowestLow(
      dataLast601,
      "MID",
      goingUp,
      goingUp ? firstHigh.indexNo + 1 : highestHigh.indexNo
    );
  }

  let trend = "SIDEBASE";
  if (
    highestHigh.highest > lastHigh.highest &&
    lowestLow.lowest < firstLow.lowest
  ) {
    trend = "DOWN";
  } else if (
    highestHigh.highest > firstHigh.highest &&
    lowestLow.lowest < lastLow.lowest
  ) {
    trend = "UP";
  }

  let valid = false;
  let high = firstHigh,
    low = firstLow;
  const perGap60 = highLowLength * 0.6;
  if (trend == "DOWN") {
    valid =
      latestCandel[4] > lowestLow.lowest &&
      latestCandel[4] < lowestLow.lowest + perGap60;
    low = firstLow;
    high = lastHigh;
    if (data.length - 1 <= lowestLow.indexNo + 3) {
      valid = false;
    }
  } else if (trend == "UP") {
    valid =
      latestCandel[4] < highestHigh.highest &&
      latestCandel[4] > highestHigh.highest - perGap60;
    high = firstHigh;
    low = lastLow;
    if (data.length - 1 <= highestHigh.indexNo + 3) {
      valid = false;
    }
  }

  if (
    !(
      highestHigh.highest !== high.highest &&
      lowestLow.lowest !== low.lowest &&
      high.highest !== low.lowest
    )
  ) {
    valid = false;
  }

  const firstHourData = data.filter((x, i) => i < 12);

  const fhdHigh = getHighestHigh(firstHourData).highest;
  const fhdLow = getLowestLow(firstHourData).lowest;

  if (
    !high ||
    !low ||
    (trend == "UP" &&
      highestHigh.highest <= fhdHigh &&
      lowestLow.lowest <= fhdLow) ||
    (trend == "DOWN" &&
      highestHigh.highest >= fhdHigh &&
      lowestLow.lowest >= fhdLow)
  ) {
    valid = false;
    trend = "SIDEBASE";
  }

  let lastCandelIsGreen = true;
  if (latestCandel[1] > latestCandel[4]) {
    lastCandelIsGreen = false;
  }

  return {
    highestHigh,
    lowestLow,
    high,
    low,
    totalCandels,
    per60,
    trend,
    valid,
    firstHourData: { fhdHigh, fhdLow },
    lastCandelIsGreen,
    avgHeight,
    lastCandelHeight: Math.abs(latestCandel[1] - latestCandel[4]),
    currentPrice: latestCandel[4],
  };
};

const getDayData = async (instrumentToken, interval = "day") => {
  let from = moment().add(-1, "months").format("YYYY-MM-DD+HH:mm:ss");

  let finalInterval = interval;
  if (interval === "month") {
    finalInterval = "day";
    from = moment().add(-65, "months").format("YYYY-MM-DD+HH:mm:ss");
  }
  let data = await getHistorical(instrumentToken, finalInterval, from);

  if (interval === "month") {
    const bag = [];
    for (let r of data) {
      const monthYear = moment(r[0]).format("YYYY-MM");
      if (!bag.find((x) => x[0] === monthYear)) {
        bag.push([monthYear]);
      }
    }
    for (let b of bag) {
      const monthData = data.filter(
        (x) => moment(x[0]).format("YYYY-MM") === b[0]
      );
      const firstCandel = monthData[0];
      const lastCandel = monthData[monthData.length - 1];

      const maxData = monthData.map((x) => x[2]);
      const minData = monthData.map((x) => x[3]);
      const volumnData = monthData.map((x) => x[5]);

      b[1] = firstCandel[1];
      b[2] = Math.max(...maxData);
      b[3] = Math.min(...minData);
      b[4] = lastCandel[4];
      b[5] = volumnData.reduce((x, y) => x + y);
    }

    data = bag;
  }

  for (const iterator of data) {
    iterator[5] = Math.abs(iterator[1] - iterator[4]);
  }
  let total = 0;
  for (const iterator of data) {
    total += iterator[5];
  }

  const avg = +(total / data.length).toFixed(2);
  const lastCandelHeight = +data[data.length - 1][5].toFixed(2);
  const allowedRange = +((avg * 70) / 100).toFixed(2);
  const goodOne = lastCandelHeight < allowedRange;

  return { avg, lastCandelHeight, goodOne, allowedRange, data };
};

const getHighestHigh = (
  data: any,
  type: any = "",
  goingUp: any = false,
  indexHigh: any = 0
) => {
  let highest,
    indexNo = 0;
  if (data[0]) {
    highest = data[0][2];
  }

  for (const item of data) {
    if (item[2] > highest) {
      highest = item[2];
      indexNo = data.indexOf(item);
    }
  }
  if (type === "FIRST" && !goingUp) {
    indexNo = indexHigh;
  } else if (type === "FIRST" && goingUp) {
    indexNo = indexNo + indexHigh;
  } else if (type === "LAST" && goingUp) {
    indexNo = indexHigh;
  } else if (type === "LAST" && !goingUp) {
    indexNo = indexHigh - (data.length + indexNo);
  } else if (type === "MID" && goingUp) {
    indexNo = indexHigh;
  } else if (type === "MID" && !goingUp) {
    indexNo = indexHigh - data.length + indexNo;
  }
  return { highest, indexNo };
};
const getLowestLow = (
  data: any,
  type: any = "",
  goingUp: any = false,
  indexLow: any = 0
) => {
  let lowest,
    indexNo = 0;
  if (data[0]) {
    lowest = data[0][3];
  }

  for (const item of data) {
    if (item[3] < lowest) {
      lowest = item[3];
      indexNo = data.indexOf(item);
    }
  }
  if (type === "FIRST" && goingUp) {
    indexNo = indexNo + indexLow;
  } else if (type === "FIRST" && !goingUp) {
    indexNo = indexLow + indexNo;
  } else if (type === "LAST" && goingUp) {
    indexNo = indexLow - indexNo + 1;
  } else if (type === "LAST" && !goingUp) {
    indexNo = indexLow;
  } else if (type === "MID" && goingUp) {
    indexNo = indexLow + indexNo;
  } else if (type === "MID" && !goingUp) {
    indexNo = indexLow - (data.length + indexNo);
  }
  return { lowest, indexNo };
};

const getDetails = async (symbol: string, type: string) => {
  const instrument = getInsruments(symbol);
  let interval = "",
    intervalParent = "";
  if (type === "swing") {
    interval = "day";
    intervalParent = "month";
  } else if (type === "intraday") {
    interval = "5minute";
    intervalParent = "day";
  }

  const priceAction = await getPriceAction(instrument, interval);
  if (
    priceAction.currentPrice > 100 &&
    priceAction.valid &&
    priceAction.lastCandelHeight > (priceAction.avgHeight * 80) / 100
  ) {
    const dayData = await getDayData(instrument, intervalParent);

    const { goodOne, avg, lastCandelHeight, allowedRange } = dayData;
    const {
      trend,
      valid,
      highestHigh,
      lowestLow,
      high,
      low,
      lastCandelIsGreen,
      lastCandelHeight: lastHeight,
      avgHeight,
      currentPrice,
    } = priceAction;
    const data = {
      instrument,
      goodOne,
      avgHeight,
      lastHeight,
      trend,
      valid,
      symbol,
      avgCandelSize: avg,
      todayCandelSize: lastCandelHeight,
      allowedCandelSize: allowedRange,
      highestHigh,
      lowestLow,
      high,
      low,
      lastCandelIsGreen,
      currentPrice,
    };
    return data;
  }
  return null;
};
function sleep(milliseconds) {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds);
}

const getTodaysIntradayStocks = async () => {
  const nifty100 = await getNifty100Stocks()
    .then((res) => res.map((x) => x.symbol))
    
  if (nifty100) {
    console.log("Nifty 100 loaded.", nifty100);

    // const volatilitedStocks = await getDailyVolatilitedStocks(
    //   process.env.LAST_TRADE_DAY
    // );
    const volatilitedStocks :any = volatility;
    
    console.log("Volatilited Stocks loaded.");

    let niftyVolatilited = volatilitedStocks.filter((x) =>
      nifty100.includes(x.Symbol)
    );
    
    for (const x of niftyVolatilited) {
      x.daily = +x["Current Day Underlying Daily Volatility (E) = Sqrt(0.94*D*D + 0.06*C*C)"] * 100;
    }

    const sum = niftyVolatilited.map((x) => x.daily).reduce((x, y) => (x += y));
    console.log('sum',sum)
    const avg = sum / niftyVolatilited.length;
    console.log('avg',avg)
    niftyVolatilited = niftyVolatilited

      .filter((x) => x.daily > avg)
      .sort((x, y) => {
        return y.daily - x.daily;
      });
     
    for (let n of niftyVolatilited) {
      n.margin = margins.find((y) => y.symbol === n.Symbol)?.margin;
    }
    niftyVolatilited = niftyVolatilited.filter((x) => x.margin >= 10);

    console.log('result',niftyVolatilited)
    const result =  niftyVolatilited.map((x) => ({ symbol: x.Symbol, margin: x.margin }));
 
    return result
  }
};

export const getIntradayStocks = async () => {
  const stocks = await getTodaysIntradayStocks();
  todaysIntradayStock = stocks;
  console.log("Intraday stocks are updated.", stocks);
  // const intradayStocks = await getSwingStocks("intraday");
  // console.log(intradayStocks);
  return stocks;
};

export const getSwingStocks = async (type: string, trend?: string) => {
  try {
    // sleep(30000)

    let interval = "";
    if (type === "swing") {
      interval = "day";
    } else if (type === "intraday") {
      interval = "5minute";
    }
    const bag = [];

    const volumedStocks = await getVolumeStocks(interval);
    if (volumedStocks) {
      const symbols = volumedStocks && volumedStocks.map((x) => x.nsecode);
      let finalStocks = symbols;

      if (type === "intraday") {
        finalStocks = symbols.filter((x) =>
          todaysIntradayStock.map((y) => y.symbol).includes(x)
        );
      }
      //  const finalStocks= swingStocks.filter(x=> symbols.includes(x))

      // const finalStocks= ["SWSOLAR","TV18BRDCST"]
      console.log("Total Stocks", finalStocks.length);
      for (let x of finalStocks) {
        try {
          console.log(
            `Process(${finalStocks.indexOf(x) + 1}/${finalStocks.length}) STOCK=>${x}`
          );

          const data = await getDetails(x, type);
          if(type==="intraday"){
            console.log("Data ", data);
          }
         
          if (data) {
            if (
              (data.lastCandelIsGreen && data.trend.toUpperCase() === "UP") ||
              (!data.lastCandelIsGreen && data.trend.toUpperCase() === "DOWN")
            ) {
              console.log("Data validated");
              if (data.valid && data.goodOne) {
                if (trend) {
                  if (data.trend.toUpperCase() === trend.toUpperCase()) {
                    console.log("Stock added in bag " + x);
                    bag.push(data);
                  }
                } else {
                  console.log("Stock added in bag " + x);
                  bag.push(data);
                }
              }
            }
          }
        } catch (error) {
          console.log('Failed to get stock details',x, error)
        }
      }
      if (bag && bag.length > 0) {
        console.log("Bag is ready with ", bag.map((x) => x.symbol).toString());
      } else {
        console.log("Better luck next time");
      }

      return bag;
    }

    // return getDetails('TITAN')
  } catch (error) {
    throw error;
  }
};
