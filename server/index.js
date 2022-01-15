const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const routerApi = require('./module/router')

require('./module/ws') // 导入ws代码

express()
    .use(cors()) // 允许跨域
    .use(bodyParser.json())
    .use(bodyParser.urlencoded({extended: false}))
    .use('/api', routerApi)
    .listen(3101, () => console.log('server is running at http://localhost:3101'))
