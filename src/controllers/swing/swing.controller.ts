import * as express from "express";
import { Request, Response } from "express";
import IControllerBase from "interfaces/IControllerBase.interface";

import AppSettings from "../../models/app-settings";

import Slot from "../../models/slot";
import moment = require("moment");
import Transaction from "../../models/transaction";
import * as mongoose from "mongoose";

class SwingController implements IControllerBase {
  public path = "/swing/v2";
  public router = express.Router();

  amount;

  noOfslots;

  // slots = [];

 //  transactions = [];

  constructor() {
    this.initRoutes();

    AppSettings.findOne()
      .exec()
      .then((x) => {
       
        if (x["swing"].amount && x["swing"].noOfslots) {
          console.log('App',x["swing"])
          const { amount, noOfslots } = x["swing"];
          this.amount = amount;
          this.noOfslots = noOfslots;
        } else {
          console.log('AppS')
            const amount = 10000,
            noOfslots = 10;
            AppSettings.updateOne({},{swing:{amount,noOfslots}}).then((y) => {
           
            this.amount = amount;
            this.noOfslots = noOfslots;
            console.log('Swing amount and slots are added.')
          });
        }
      });
  }

  public initRoutes() {
    this.router.get(`${this.path}/`, this.index);
    this.router.post(`${this.path}/addRemoveAmount`, this.addRemoveAmount);
    this.router.post(`${this.path}/execute`, this.execute);
    this.router.post(`${this.path}/executeOut`, this.executeOut);
    this.router.get(`${this.path}/slots`, this.getSlots);
    this.router.get(`${this.path}/transactions`, this.getTransactions);
  }

  updateAmount = async () => {
    await AppSettings.updateOne({}, { swing: { amount: this.amount,noOfslots:this.noOfslots } });
  };
  addRemoveAmount = async (req: Request, res: Response) => {
    const { amount, action } = req.body;
    const oldAmount = this.amount;
    if (action === "ADD") {
      this.amount += amount;
    } else if (action === "REMOVE") {
      this.amount -= amount;
    }

    await this.updateAmount();

    const newAmount = this.amount;
    res.send({ oldAmount, newAmount });
  };
  getSlots = async (req: Request, res: Response) => {
    const slots = await Slot.find().exec();
    res.send(slots);
  };
  getTransactions = async (req: Request, res: Response) => {
    const transactions = await Transaction.find().exec();
    res.send(transactions);
  };

  executeOut = async (req: Request, res: Response) => {
    const { symbol, orderPrice } = req.body;
    const exists = await Slot.findOne({ symbol });

    if (!exists) {
      res.send({ resCode: "STOCK_NOT_FOUND" });
      return;
    }
    const closingAmount = orderPrice * exists["qty"];
    this.amount += closingAmount;

    await this.updateAmount();

    await Slot.deleteOne({ symbol: symbol });

    const item = new Transaction({
      _id:mongoose.Types.ObjectId(),
      type: "OUT",
      symbol,
      orderPrice,
      balancedAmount: this.amount,
      closingAmount,
      qty: exists["qty"],
      createdOn: moment().format(),
    });
    
    await item.save().catch((error) => console.log("Failed to save transaction", error));
    
    res.send({ symbol, balancedAmount: this.amount, resCode: "EXECUTED" });
  };

  execute = async (req: Request, res: Response) => {
    const { symbol, orderPrice } = req.body;

    const slotsLength = await Slot.find().then((x) => x.length);

    if (slotsLength === this.noOfslots) {
      res.send({ resCode: "SLOTS_ARE_FULL" });
      return;
    }

    if (slotsLength) {
      const exists = await Slot.exists({ symbol });
      if (exists) {
        res.send({ resCode: "STOCK_ALREADY_EXISTS" });
        return;
      }

      // const balancedAmount =  this.slots.map(x=>x.investedAmount).reduce((x,y)=>x+y)
      // if(balancedAmount!==this.amount){
      //   res.send({resCode:"BALANCE_NOT_MATCHING"})
      //   return;
      // }
    }

    const amountForThisOrder = this.amount / (this.noOfslots - slotsLength);

    const qty = Math.floor(amountForThisOrder / orderPrice);

    const investedAmount = orderPrice * qty;

    if (!this.amount || !investedAmount || this.amount < investedAmount) {
      res.send({
        resCode: "AMOUNT_IS_NOT_AVAILABLE",
        balancedAmount: this.amount,
        amountAllotedForThisOrder: amountForThisOrder,
      });
      return;
    }
    this.amount = this.amount - investedAmount;

    await this.updateAmount();

    const item = {
      _id:mongoose.Types.ObjectId(),
      type: "IN",
      symbol,
      orderPrice,
      balancedAmount: this.amount,
      investedAmount,
      qty,
      createdOn: moment().format(),
    };

    const slot = new Slot(item);
    await slot
      .save()
      .catch((error) => console.log("Failed to save slot", error));

    const tran = new Transaction(item);
    await tran
      .save()
      .catch((error) => console.log("Failed to save transaction", error));

    // this.slots.push(item);
    // this.transactions.push(item);
    res.send(item);
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

    res.send({ users });
  };
}

export default SwingController;
