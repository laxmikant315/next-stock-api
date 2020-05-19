import * as mongoose from 'mongoose';

const appSettingsSchema = new mongoose.Schema({
    
    intradayStocks: Array
  
})

export default mongoose.model('AppSettings',appSettingsSchema)