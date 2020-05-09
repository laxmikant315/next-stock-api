import * as express from 'express'
import { Application } from 'express'
// import mongoose from 'mongoose'

const mongoose = require('mongoose');
import { env } from 'process'

class App {
    public app: Application
    public port: number

    constructor(appInit: { port: number; middleWares: any; controllers: any; }) {
        this.app = express()
        this.port = appInit.port

        this.middlewares(appInit.middleWares)
        this.routes(appInit.controllers)
        this.assets()
        this.template()
    }

    private async middlewares(middleWares: { forEach: (arg0: (middleWare: any) => void) => void; }) {
        middleWares.forEach(middleWare => {
            this.app.use(middleWare)
        })

        console.log('Database is connecting.') 

        await mongoose.connect(env.MONGO_URL, {
                useNewUrlParser: true,
                useUnifiedTopology: true
         });
    
         console.log('Database connected.') 
        
        
    }

    private routes(controllers: { forEach: (arg0: (controller: any) => void) => void; }) {
        controllers.forEach(controller => {
            this.app.use('/', controller.router)
        })
    }

    private assets() {
        this.app.use(express.static('public'))
        this.app.use(express.static('views'))
        
    }

    private template() {
        this.app.set('view engine', 'pug')
    }

    public listen() {
        const server= this.app.listen(this.port, () => {
            console.log(`App listening on the http://localhost:${this.port}`)
        })
        server.timeout = 10000000;


    }
}

export default App