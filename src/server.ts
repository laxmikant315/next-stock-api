import App from './app'

import * as bodyParser from 'body-parser'
import loggerMiddleware from './middleware/logger'

import HomeController from './controllers/home/home.controller'
import { env } from 'process'
import BullController from './controllers/bull/bull.controller'
import SwingController from './controllers/swing/swing.controller'
import KiteController from './controllers/kite/kite.controller'
import Knex = require('knex')

const cors = require('cors')
require('dotenv').config()

export const db = Knex({
    // connect to your own database here
    client: 'pg',
    connection: env.DATABASE_URL
});

const app = new App({
    port: +env.PORT || 5003,
    controllers: [
        new HomeController(),
        new BullController(),
        new SwingController(),
        // new KiteController()
    ],
    middleWares: [
        bodyParser.json(),
        bodyParser.urlencoded({ extended: true }),
        loggerMiddleware,
        cors()

    ]
})
app.listen()

