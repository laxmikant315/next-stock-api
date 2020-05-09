import * as mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
    
    endpoint: String,
    expirationTime:String,
    keys: {
        auth: String,
        p256dh: String
    }
})

export default mongoose.model('Subscription',subscriptionSchema)