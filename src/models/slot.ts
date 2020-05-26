import * as mongoose from 'mongoose';

const slotSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    type: String,
    symbol: String,
    orderPrice: Number,
    balancedAmount: Number,
    investedAmount: Number,
    qty: Number,
    createdOn: Date,
})

export default mongoose.model('Slot',slotSchema)