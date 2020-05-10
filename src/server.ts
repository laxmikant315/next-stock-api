import App from './app'

import * as bodyParser from 'body-parser'
import loggerMiddleware from './middleware/logger'

import HomeController from './controllers/home/home.controller'
import { env } from 'process'
import BullController from './controllers/bull/bull.controller'

var cors = require('cors')
require('dotenv').config()


const app = new App({
    port: +env.PORT || 5003,
    controllers: [
        new HomeController(),
        new BullController()
    ],
    middleWares: [
        bodyParser.json(),
        bodyParser.urlencoded({ extended: true }),
        loggerMiddleware,
         cors("http://localhost:3000",{ credentials :  false})
       
    ]
})
app.listen()

