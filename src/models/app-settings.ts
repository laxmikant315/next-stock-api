import * as mongoose from 'mongoose';

const appSettingsSchema = new mongoose.Schema({
    
    intradayStocks: Array,
    swing:{
        amount :Number,
        noOfslots : Number
    }
    
})

export default mongoose.model('AppSettings',appSettingsSchema)