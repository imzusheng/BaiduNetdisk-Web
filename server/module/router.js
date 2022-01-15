const express = require("express");
const {listLocalFiles, openExplorer, deleteFiles, isExist, deleteDownload} = require("./util")
const path = require("path");
const querystring = require("querystring")
const https = require("https")
const fs = require("fs")

const routerApi = express.Router()

// 获取token授权
routerApi.get('/auth', async (req, res) => {
  delete require.cache[require('../auth.json')]
  const result = require('../auth.json')
  res.setHeader('Last-Modified', (new Date).toUTCString()) // 防止缓存
  res.send({
    result,
    filePath: 'file:///' + path.join(path.resolve(), 'auth.json').replace(/\\/g, '/')
  })
})

routerApi.post('/accessToken', async (req, res) => {
  let postResult = {
    error: true,
    msg: {}
  }
  delete require.cache[require('../auth.json')]
  const auth = require('../auth.json')
  const {code} = req.body
  const url = `https://openapi.baidu.com/oauth/2.0/token?grant_type=authorization_code&code=${code}&client_id=${auth.AppKey}&client_secret=${auth.SecretKey}&redirect_uri=${auth.redirect_uri}`
  const accessTokenResult = await getAccessToken()
  if (!accessTokenResult?.error) {
    postResult.error = false
    await writeJson(accessTokenResult)
  }
  postResult.msg = accessTokenResult
  
  // 写入token到auth.json
  function writeJson(data) {
    const jsonPath = path.join(__dirname, '../auth.json')
    return new Promise(resolve => {
      // 是否存在json文件
      const exist = isExist(jsonPath)
      let jsonData
      if (exist) { // 存在则引入
        jsonData = require(jsonPath)
        Object.keys(data).forEach(k => {
          if (data[k]) jsonData[k] = data[k]
        })
      } else {
        jsonData = data
      }
      
      fs.writeFile(jsonPath, JSON.stringify(jsonData), 'utf8', err => {
        if (err) console.log(err)
        resolve()
      })
    })
  }
  
  // 获取access_token
  function getAccessToken() {
    return new Promise(resolve => {
      https.get(url, res => {
        res.setEncoding('utf-8')
        let str = ''
        res.on('data', data => str += data)
        res.on('end', () => {
          let result
          try {
            result = JSON.parse(str)
          } catch (e) {
            console.error(e)
          }
          resolve(result)
        })
      })
    })
  }
  res.setHeader('Last-Modified', (new Date).toUTCString()) // 防止缓存
  res.send(postResult)
})

routerApi.get('/logout', async (req, res) => {
  const jsonPath = path.join(__dirname, '../auth.json')
  // 是否存在json文件
  const exist = isExist(jsonPath)
  let jsonData
  if (exist) {
    jsonData = require(jsonPath)
    delete jsonData['access_token']
  }
  
  fs.writeFile(jsonPath, JSON.stringify(jsonData), 'utf8', err => {
    if (err) console.log(err)
  })
  res.send('success')
})

// 列出本地文件
routerApi.get('/listLocal', async (req, res) => {
  res.send(await listLocalFiles(req.headers?.useruk))
})

// 打开本地下载目录
routerApi.get('/openExplorer', async (req, res) => {
  const filename = req.query.filename
  await openExplorer(req.headers?.useruk, filename)
  res.send('success')
})

// 删除本地文件
routerApi.get('/deleteFiles', async (req, res) => {
  const filenames = req.query.args
  const uk = req.headers?.useruk
  const result = deleteFiles(uk, filenames)
  res.send(result)
})

// 查看未完成的任务
routerApi.get('/undoneList', async (req, res) => {
  const filePath = path.join(__dirname, './unDoneList.json')
  const result = isExist(filePath) ? require(filePath) : {}
  res.send(result)
})

routerApi.get('/deleteDownload', async (req, res) => {
  const files = req.query.list
  const uk = req.headers?.useruk
  const result = await deleteDownload(uk, files)
  res.send(result)
})

// proxy https版本
routerApi.get('/proxy', async (req, res) => {
  const result = await get(req)
  res.send(result)
})

// 封装https发送get请求
function get(req) {
  return new Promise(resolve => {
    const {
      url,
      params,
      headers = {
        'User-Agent': 'pan.baidu.com'
      }
    } = req.query
    
    // 拼接url， 将参数加到url后
    const getUrl = url + (params !== undefined ? '?' + querystring.stringify(JSON.parse(params)) : '')
    
    https.get(decodeURIComponent(getUrl), {headers}, response => {
      response.setEncoding('utf-8')
      let str = ''
      response.on('data', data => str += data)
      response.on('end', () => {
        let result
        try {
          result = JSON.parse(str)
        } catch (e) {
          console.log(e)
          result = {
            error: true,
            data: str
          }
        }
        resolve(result)
      })
    })
  })
}

module.exports = routerApi
