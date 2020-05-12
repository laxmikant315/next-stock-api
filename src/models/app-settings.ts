import * as mongoose from 'mongoose';

const appSettingsSchema = new mongoose.Schema({
    
    nifty100Stocks: Array,
    dailyVolitilityStocks:Array,
  
})

export default mongoose.model('AppSettings',appSettingsSchema)