import * as csv from "async-csv";
import * as fs from "fs";
import path = require("path");
import * as instruments from "./instruments.json";

import axios from "axios";
import { env } from "process";
//@ts-ignore
import * as moment from "moment";


import * as mongoose from "mongoose";
import e = require("express");

import * as mockData from "./mockData.json";
import { db } from "../../../server";
var dataMain: any = [];

let todaysIntradayStock;

export const deleteIntradayStocks = async () => {
  todaysIntradayStock = [];


  // await Notification.deleteMany({ type: "intraday" }).catch((e) => {
  //   console.log("Failed to delete intraday stocks.", e);
  // });

  await db('notifications').del().where({ type: "intraday" }).catch(e => console.log("Failed to delete intraday stocks.", e))




  // await Notification.deleteMany({ type: "priceaction" }).catch((e) => {
  //   console.log("Failed to delete intraday Logs.", e);
  // });

  await db('notifications').del().where({ type: "priceaction" }).catch(e => console.log("Failed to delete intraday stocks.", e))

  console.log("Intraday stocks & logs deleted");
};
export const getDailyVolatilitedStocks = async (dateNow: string) => {
  try {
    const obj = await axios
      // .get(`https://www.nseindia.com/archives/nsccl/volt/CMVOLT_${dateNow}.CSV`)
      .get(
        `https://archives.nseindia.com/archives/nsccl/volt/CMVOLT_${dateNow}.CSV`
      );
    // const data = this.fetchData();
    const data = await csv.parse(obj.data);

    return data;
  } catch (error) {
    console.log("Failed to load daily volatilited stocks.");
  }
};

const nifty200 = "46553",
  nifty100 = "33619";
export const getVolumeStocks = async (interval = "5minute") => {
  let scan_clause = `%7B${nifty200}%7D+(+%5B+0+%5D+5+minute+volume+%3E+(+(+%5B+-1+%5D+5+minute+volume+%2B+%5B+-2+%5D+5+minute+volume+%2B+%5B+-3+%5D+5+minute+volume+)+%2F+3+)+*+2+)`;
  if (interval === "day") {
    scan_clause =
      "(+%7B57960%7D+(+latest+volume+%3E+(+(+1+day+ago+volume+%2B+2+days+ago+volume+%2B+3+days+ago+volume+%2B+4+days+ago+volume+%2B+5+days+ago+volume+)+%2F+5+)+*+2.5+)+)+";
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
      if (symbol && stock) {
        return stock[0];
      } else {
        return null;
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
  // return mockData.data.candles;

  const url = `${env.zerodhaUrl}oms/instruments/historical/${instrumentToken}/${interval}?from=${from}&to=${to}`;
  console.log(url)
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
const getLastestVolumendCandel = (data: any) => {
  const candelCount = 3;
  let candel;
  let index;

  for (let i = 0; i < candelCount; i++) {
    const idx = data.length - (i + 1);
    const candelData = data[idx];
    if (!candelData) {
      return null;
    }
    if (candel) {
      if (+candelData[5] > +candel[5]) {
        candel = candelData;
        index = idx;
      }
    } else {
      candel = candelData;
      index = idx;
    }
  }
  return { candel, index };
};

const getCandelIsGreen = (candel) => candel && candel[1] < candel[4];
const getPriceAction = async (data, secondTry = false) => {
  let avgHeight = 0;
  if (!data) {
    return null;
  }

  if (data && data.length) {
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

  // let latestCandel = data[data.length - 1];

  const volumedCandel = getLastestVolumendCandel(data);
  if (!volumedCandel) {
    return null;
  }
  const latestCandel = volumedCandel.candel;
  if (!latestCandel) {
    return null;
  }
  const latestCandelIndex = volumedCandel.index;
  // if(interval === "5minute"){

  //   latestCandel = data[data.length - 2];
  // }

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

  let high = firstHigh,
    low = firstLow;

  if (
    highestHigh.highest > lastHigh.highest &&
    lowestLow.lowest < firstLow.lowest
  ) {
    trend = "DOWN";

    low = firstLow;
    high = lastHigh;


  } else if (
    highestHigh.highest > firstHigh.highest &&
    lowestLow.lowest < lastLow.lowest
  ) {
    trend = "UP";
    high = firstHigh;
    low = lastLow;
  }

  let valid = true;
  let invalidReason = "";
  let saveLog = false;
  // Trend Length Validation && Trend Line
  const trendLine = [];

  let a, b, c, d, e;
  if (trend === "UP") {
    a = lowestLow.indexNo;
    b = high.indexNo;
    c = low.indexNo;
    d = highestHigh.indexNo;
    e = latestCandelIndex;
  } else if (trend === "DOWN") {
    a = highestHigh.indexNo;
    b = low.indexNo;
    c = high.indexNo;
    d = lowestLow.indexNo;
    e = latestCandelIndex;
  }
  const peak = d - a;
  const volumned = e - d;
  if (peak < volumned) {

    valid = false;

    invalidReason = `volumed candel distance from Trend Peak is invalid.peak:${peak},volumned:${volumned}`;
  }

  for (let i = a; i <= e; i++) {
    const candel = data[i];
    let candelAvg = (candel[1] + candel[2] + candel[3] + candel[4]) / 4;

    if (trend === "UP") {
      if (i === a || i === c) {
        candelAvg = candel[3];
      } else if (i === b || i === d || i > d) {
        candelAvg = candel[2];
      }
    } else if (trend === "DOWN") {
      if (i === a || i === c) {
        candelAvg = candel[2];
      } else if (i === b || i === d || i > d) {
        candelAvg = candel[3];
      }
    }
    trendLine.push(candelAvg);
  }

  // Trend Length Validation End
  if (valid) {
    const perGap60 = highLowLength * 0.6;
    if (trend == "DOWN") {
      const val0 = latestCandelIndex !== lowestLow.indexNo;
      const val1 = latestCandel[4] > lowestLow.lowest;
      const val2 = latestCandel[4] < lowestLow.lowest + perGap60;

      valid = val0 && val1 && val2;



      if (!valid) {
        if (!val0) {
          invalidReason =
            "Volumed candel is lowest low candel. Invalid price action";
        } else if (!val1) {
          invalidReason = "Current price is less than lowest";
        } else if (!val2) {
          invalidReason = "Gap 60 Validation failed";
        }
      }

      if (latestCandelIndex <= lowestLow.indexNo) {
        valid = false;
        invalidReason = "Trend is on bottom, movement pending";
      } else if (latestCandelIndex <= lowestLow.indexNo + 3) {
        valid = false;
        invalidReason = "Volumed candel is very closed";
      }
    } else if (trend == "UP") {
      const val0 = latestCandelIndex !== highestHigh.indexNo;
      const val1 = latestCandel[4] < highestHigh.highest;
      const val2 = latestCandel[4] > highestHigh.highest - perGap60;
      valid = val0 && val1 && val2;



      if (!valid) {
        if (!val0) {
          invalidReason =
            "Volumed candel is highest high candel. Invalid price action";
        } else if (!val1) {
          invalidReason = "Current price is greater than highest";
        } else if (!val2) {
          invalidReason = "Gap 60 Validation failed";
        }
      }
      if (latestCandelIndex <= highestHigh.indexNo) {
        valid = false;
        invalidReason = "Trend is on top, movement pending";
      } else if (data.length - 1 <= highestHigh.indexNo + 3) {
        valid = false;
        invalidReason = "Volumed candel is very closed";
      }
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

  if (!valid && !invalidReason) {
    invalidReason = "Price action is invalid";
  }

  let fhdHigh, fhdLow; //now fhdHigh is Only as per open close not as per high low
  if (!secondTry) {
    const firstHourData = data.filter((x, i) => i < 12);

    const fhdHighCandel = getHighestHigh(firstHourData);
    const fhdLowCandel = getLowestLow(firstHourData);

    // const fhdHigh = fhdHighCandel.highest;
    // const fhdLow = fhdLowCandel.lowest;

    if (getCandelIsGreen(fhdHighCandel)) {
      fhdHigh = firstHourData[fhdHighCandel.indexNo][4];
    } else {
      fhdHigh = firstHourData[fhdHighCandel.indexNo][1];
    }

    if (getCandelIsGreen(fhdLowCandel)) {
      fhdLow = firstHourData[fhdLowCandel.indexNo][1];
    } else {
      fhdLow = firstHourData[fhdLowCandel.indexNo][4];
    }

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
      invalidReason = "Side base trend";
    }
  }


  // validate if previous candel of volumed candel is valid or invalid

  // Calculate LastCandelIsGreen or red
  let lastCandelIsGreen = getCandelIsGreen(latestCandel);

  if (valid) {
    if (trend === "UP" && !lastCandelIsGreen) {
      valid = false;
      invalidReason = "Opposite trend volumed candel";
    } else if (trend === "DOWN" && lastCandelIsGreen) {
      valid = false;
      invalidReason = "Opposite trend volumed candel";
    }
  }



  // Trend line validation Start
  if (valid) {
    if (trend === "UP") {
      if (highestHigh.indexNo < latestCandelIndex) {
        //console.log(`lowPlus30 = low.lowest${low.lowest} + ((highestHigh.highest${highestHigh.highest}-low.lowest${low.lowest})*0.3)`)

        const lowPlus30 = low.lowest + ((highestHigh.highest - low.lowest) * 0.15)
        // console.log(`lowPlus30=${lowPlus30}`)

        for (let i = highestHigh.indexNo; i <= latestCandelIndex; i++) {

          if (data[i] && data[i][3] < lowPlus30) {
            console.log(data[i])
            valid = false;
          }
        }
      }
    } else if (trend === "DOWN") {
      if (lowestLow.indexNo < latestCandelIndex) {
        const highMinus30 = high.highest - ((high.highest - lowestLow.lowest) * 0.15)
        for (let i = lowestLow.indexNo; i <= latestCandelIndex; i++) {
          if (data[i] && data[i][2] > highMinus30) {
            valid = false;
          }
        }
      }
    }
    if (!valid) {
      invalidReason = "Trend line validation failed";

      saveLog = true;
    }
  }
  // Trend line validation End

  if (valid) {

    const previosCandel = data[latestCandelIndex - 1];
    if (trend === "UP") {
      if (previosCandel[2] > latestCandel[4]) {
        valid = false;
      }
    } else if (trend === "DOWN") {
      if (previosCandel[3] < latestCandel[4]) {
        valid = false;
      }
    }
    if (!valid) {
      invalidReason = "Previous candel of volumed candel is invalid.";
      saveLog = true;
    }
  }


  if (valid) {
    valid = validatePriceAction({ ll: lowestLow.lowest, h: high.highest, l: low.lowest, hh: highestHigh.highest, trend })
    if (!valid) {
      invalidReason = "Price action HH,LL,L,H gap invalid.";
      saveLog = true;
    }
  }
  //end




  return {
    highestHigh: highestHigh.highest,
    highestHighIndex: highestHigh.indexNo,
    lowestLow: lowestLow.lowest,
    lowestLowIndex: lowestLow.indexNo,
    high: high.highest,
    highIndex: high.indexNo,
    low: low.lowest,
    lowIndex: low.indexNo,
    totalCandels,
    per60,
    trend,
    valid,
    invalidReason,
    firstHourData: { fhdHigh, fhdLow },
    lastCandelIsGreen,
    avgHeight,
    latestCandel,
    latestCandelIndex,
    lastCandelHeight: Math.abs(latestCandel[1] - latestCandel[4]),
    currentPrice: latestCandel[4],
    trendLine,
    saveLog: true
  };
};


const validatePriceAction = ({ h, l, hh, ll, trend }: { h: number, l: number, hh: number, ll: number, trend: string }) => {
  const a = ((Math.abs(ll - h)) * 20 / 100);
  const b = ((Math.abs(hh - l)) * 20 / 100);

  if (trend === "UP") {
    // console.log(`${l}>(${a}+${ll})[${a+ll}] && ${h}<(${hh}-${b})[${b+hh}]`)
    if (l > (a + ll) && h < (hh - b)) {
      return true
    }
  } else if (trend === "DOWN") {
    // console.log(`${h}<(${hh}-${b})[${hh-b}] && ${l}>(${ll}+${a})[${ll+a}]`)
    if (h < (hh - b) && l > (ll + a)) {
      return true
    }
  }
  return false

}
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

const getPriceActionLength = (priceAction) =>
  Math.abs(priceAction.lowestLow.indexNo - priceAction.highestHigh.indexNo);

export const getDetails = async (symbol: string, type: string) => {
  const instrument = getInsruments(symbol);

  if (!instrument) {
    return null;
  }

  let interval = "",
    intervalParent = "";
  if (type === "swing") {
    interval = "day";
    intervalParent = "month";
  } else if (type === "intraday") {
    interval = "5minute";
    intervalParent = "day";
  }

  let from = "";
  if (interval === "5minute") {
    from = moment().format("YYYY-MM-DD") + "+09:15:00";
  } else if (interval === "day") {
    from = moment().add(-60, "days").format("YYYY-MM-DD") + "+09:15:00";
  }
  console.log('from', from)
  const data = await getHistorical(instrument, interval, from);

  let priceAction = await getPriceAction(data);

  const priceActionLength = getPriceActionLength(priceAction);

  let secondTry = false, secondTryPriceActionLength = 0, secondTryPriceActionSecondLength = 0;

  if (priceAction && !priceAction.valid) {

    let startIndex;
    if (priceAction.trend === "UP") {
      startIndex = priceAction.highestHigh.indexNo;
    } else if (priceAction.trend === "DOWN") {
      startIndex = priceAction.lowestLow.indexNo;
    }

    const data2 = data.slice(startIndex, data.length);

    const priceActionSecond = await getPriceAction(data2, true);

    if (priceActionSecond) {
      const priceActionSecondLength = getPriceActionLength(priceActionSecond);

      if (priceActionSecond && priceActionSecondLength > priceActionLength) {
        priceAction = priceActionSecond;
        // secondTry = { bit: true, priceActionLength, priceActionSecondLength };
        secondTry = true;
        secondTryPriceActionLength = priceActionLength;
        secondTryPriceActionSecondLength = priceActionSecondLength
      }
    }
  }

  if (!priceAction) {
    return null;
  }
  if (type === "intraday" && priceAction.saveLog) {
    try {
      const { saveLog, firstHourData, latestCandel, per60, totalCandels, ...rest } = priceAction;
      insertNotification({ ...rest, type: "priceaction", symbol });
    } catch (error) { }
  }
  const candelHeightIsValid =
    priceAction.lastCandelHeight > (priceAction.avgHeight * 60) / 100;

  if (
    priceAction.currentPrice > 100 &&
    priceAction.valid &&
    !candelHeightIsValid
  ) {
    console.log(`Volumed candel's height is invalid for stock ${symbol}`);
  }
  let tradeInfoOrderPrice, tradeInfoSl1, tradeInfoTarget;

  if (
    priceAction.currentPrice > 100 &&
    priceAction.valid &&
    candelHeightIsValid
  ) {


    if (type === "intraday") {
      const formula = (price: number) => Math.round((price / 3000) * 10) / 10;
      const properGap = (price: number) => price / 125;

      let orderPrice, sl1, target;
      if (priceAction.trend === "UP") {

        const price = priceAction.latestCandel[2];
        orderPrice = price + formula(price);
        sl1 = orderPrice - properGap(orderPrice)
        target = orderPrice + properGap(orderPrice)



      } else if (priceAction.trend === "DOWN") {
        const price = priceAction.latestCandel[3];
        orderPrice = price - formula(price);

        sl1 = orderPrice + properGap(orderPrice)
        target = orderPrice - properGap(orderPrice)

      }
      orderPrice = Math.round(orderPrice * 20) / 20
      sl1 = Math.round(sl1 * 20) / 20
      target = Math.round(target * 20) / 20

      // tradeInfo = { orderPrice, sl1, target }
      tradeInfoOrderPrice = orderPrice;
      tradeInfoSl1 = sl1;
      tradeInfoTarget = target

    }



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
      trendLine,
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
      trendLine,
      secondTry,
      secondTryPriceActionLength,
      secondTryPriceActionSecondLength,
      tradeInfoOrderPrice, tradeInfoSl1, tradeInfoTarget
    };


    console.log("Price Action", data);
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
  // const nifty100 = await getNifty100Stocks().then((res) =>
  //   res.map((x) => x.symbol)
  // );

  // const appSettings = await AppSettings.findOne().exec();
  const appSettings = await db.select().table('appSettings').first();

  const intradayStocks = appSettings["intradayStocks"];

  return intradayStocks;
};

export const insertNotification = async (notification) => {
  // Notification.find(x=>x.)
  const today = moment();
  let allow = false;
  if (notification.type === "swing") {
    // const stock = await Notification.findOne({
    //   createDt: {
    //     $gte: today.startOf("day").toDate(),
    //     $lt: today.endOf("day").toDate(),
    //   },
    //   symbol: notification.symbol,
    // });

    const stock = await db.select().table('notifications').where({ symbol: notification.symbol }).whereBetween('createDt', [today.startOf("day").toDate(), today.endOf("day").toDate()]);



    if (!stock) {
      allow = true;
    }
  } else {
    allow = true;
  }

  if (allow) {
    const notificationObj = {
      createDt: moment().format(),
      ...notification,
    };


    // await notificationObj
    //   .save()
    //   .catch((error) => console.log("Failed to save notification", error));


    db.transaction(trx => {
      trx.insert({
        createDt: moment().format(),
        ...notification
      })
        .into('notifications')
        .then(trx.commit)
        .catch(trx.rollback)
    })
      .catch(err => {
        console.log("Failed to save notification", err)

      })
    console.log("Document inserted");
    return true;
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
        if (!todaysIntradayStock) {
          await getIntradayStocks();
        }
        finalStocks = symbols.filter((x) =>
          todaysIntradayStock.includes(x)
        );
      }
      //  const finalStocks= swingStocks.filter(x=> symbols.includes(x))

      // const finalStocks= ["SWSOLAR","TV18BRDCST"]
      console.log("Total Stocks", finalStocks.length);

      if (type === "intraday") {
        // finalStocks.push("NIFTY 50")
      }
      for (let x of finalStocks) {
        try {
          console.log(
            `Process(${finalStocks.indexOf(x) + 1}/${finalStocks.length
            }) STOCK=>${x}`
          );

          const data = await getDetails(x, type);
          if (type === "intraday") {
            console.log("Data ", data);
          }

          if (data) {
            if (
              type === "intraday" ||
              (data.lastCandelIsGreen && data.trend.toUpperCase() === "UP") ||
              (!data.lastCandelIsGreen && data.trend.toUpperCase() === "DOWN")
            ) {
              if (data.valid && data.todayCandelSize <= data.avgCandelSize) {
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
          console.log("Failed to get stock details", x, error);
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
