import * as mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  type: String,
  symbol: String,
  orderPrice: Number,
  balancedAmount: Number,
  investedAmount: Number,
  closingAmount:Number,
  qty: Number,
  createdOn: Date,
});

export default mongoose.model("Transaction", transactionSchema);
