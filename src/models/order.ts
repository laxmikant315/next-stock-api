import * as mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  symbol: String,
  orderNo: String,
  status: String,
  tradingsymbol:String,
  order_type:String,
  createdOn: Date,
});

export default mongoose.model("Order", orderSchema);
