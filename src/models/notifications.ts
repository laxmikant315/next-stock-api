import * as mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    type:String,
    createDt:Date,
    instrument: String,
    avgHeight:Number,
    lastHeight:Number,
    goodOne: Boolean,
    trend: String,
    valid: Boolean,
    symbol: String,
    avgCandelSize: Number,
    todayCandelSize: Number,
    allowedCandelSize: Number,
    currentPrice:Number,
    trendLine:Array,
    highestHigh: {
        highest: Number,
        indexNo: Number,
    },
    lowestLow: {
        lowest: Number,
        indexNo: Number,
    },
    high: {
        highest: Number,
        indexNo: Number,
    },
    low: {
        lowest: Number,
        indexNo: Number,
    },
    lastCandelIsGreen: Boolean
})

export default mongoose.model('Notification',notificationSchema)