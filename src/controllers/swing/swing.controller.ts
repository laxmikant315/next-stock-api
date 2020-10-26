import * as express from "express";
import { Request, Response } from "express";
import IControllerBase from "interfaces/IControllerBase.interface";

//@ts-ignore
import moment = require("moment");
import * as mongoose from "mongoose";
import { db } from "../../server";

class SwingController implements IControllerBase {
  public path = "/swing/v2";
  public router = express.Router();

  amount;

  noOfslots;

  // slots = [];

  //  transactions = [];

  async getAppSettings() {
    db.first().table("appSettings")
      .then((x) => {

        if (x.swingAmount && x.swingNoOfSlots) {

          this.amount = x["swingAmount"];
          this.noOfslots = x["swingNoOfSlots"];
        } else {

          const amount = 10000,
            noOfslots = 10;


          db('appSettings').first().update({ swingAmount: amount, swingNoOfSlots: noOfslots }).then(() => {
            this.amount = amount;
            this.noOfslots = noOfslots;
            console.log('Swing amount and slots are added.')
          });

        }
      });
  }
  constructor() {
    this.initRoutes();
    this.getAppSettings().then(() => {
      console.log('Completed')
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
    // await AppSettings.updateOne({}, { swing: { amount: this.amount, noOfslots: this.noOfslots } });
    await db('appSettings').update({ swingAmount: this.amount, swingNoOfslots: this.noOfslots });
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
    // const slots = await Slot.find().sort({ createdOn: -1 }).exec();
    const slots = await db('slots').orderBy("createdOn", "desc");
    res.send(slots);
  };
  getTransactions = async (req: Request, res: Response) => {
    // const transactions = await Transaction.find().exec();
    const transactions = await db('transactions').orderBy("createdOn", "desc");
    res.send(transactions);
  };

  executeOut = async (req: Request, res: Response) => {
    const { symbol, orderPrice } = req.body;
    // const exists = await Slot.findOne({ symbol });
    const exists = await db('slots').where({ symbol });


    if (!exists) {
      res.send({ resCode: "STOCK_NOT_FOUND" });
      return;
    }
    const closingAmount = orderPrice * exists["qty"];
    this.amount += closingAmount;

    await this.updateAmount();

    // await Slot.deleteOne({ symbol: symbol });
    await db('slots').del().where({ symbol });

    const item = {
      type: "OUT",
      symbol,
      orderPrice,
      balancedAmount: this.amount,
      closingAmount,
      qty: exists["qty"],
      createdOn: moment().format(),
    };

    // await item.save().catch((error) => console.log("Failed to save transaction", error));
    await db('slots').where({ symbol }).update(item).catch((error) => console.log("Failed to save transaction", error));

    res.send({ symbol, balancedAmount: this.amount, resCode: "EXECUTED" });
  };

  execute = async (req: Request, res: Response) => {
    const { symbol, orderPrice } = req.body;

    // const slotsLength = await Slot.find().then((x) => x.length);
    const slotsLength = await db('slots').then(x => x.length);
    if (slotsLength === this.noOfslots) {
      res.send({ resCode: "SLOTS_ARE_FULL" });
      return;
    }

    if (slotsLength) {
      // const exists = await Slot.exists({ symbol });
      const exists = await db('slots').where({ symbol });
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
      _id: mongoose.Types.ObjectId(),
      type: "IN",
      symbol,
      orderPrice,
      balancedAmount: this.amount,
      investedAmount,
      qty,
      createdOn: moment().format(),
    };

    // const slot = new Slot(item);

    // await slot
    //   .save()
    //   .catch((error) => console.log("Failed to save slot", error));


    db.transaction(trx => {
      trx.insert(item)
        .into('slots')
        .then(trx.commit)
        .catch(trx.rollback)
    })
      .catch(err => {
        console.log("Failed to save slot", err)
      }).then(() => console.log("Slot inserted in database"))

    // const tran = new Transaction(item);
    // await tran
    //   .save()
    //   .catch((error) => console.log("Failed to save transaction", error));

    db.transaction(trx => {
      trx.insert(item)
        .into('transactions')
        .then(trx.commit)
        .catch(trx.rollback)
    })
      .catch(err => {
        console.log("Failed to save transaction", err)
      }).then(() => console.log("Transaction inserted in database"))

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
