import * as mongoose from 'mongoose';

const expoPushTokenSchema = new mongoose.Schema({
    
    token:String
   
})

export default mongoose.model('ExpoPushToken',expoPushTokenSchema)