const express = require("express")
const path = require("path");
const querystring = require("querystring")
const https = require("https")
const fs = require("fs")
const axios = require('axios')
const fetch = require('node-fetch')

const {
  listLocalFiles,
  openExplorer,
  deleteFiles,
  isExist,
  deleteDownload,
  handleRecordTasks,
  taskFilename,
  toolsReadFile
} = require("../util")

axios.defaults.headers['X-Requested-With'] = 'XMLHttpRequest'
// 请求拦截
axios.interceptors.request.use(config => {
  return config
})

const routerApi = express.Router()

// 获取token授权
routerApi.get('/auth', async (req, res) => {
  const result = toolsReadFile(path.join(path.resolve(), 'auth.json'))
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
  const auth = toolsReadFile(path.join(path.resolve(), 'auth.json'))
  const {AppKey, SecretKey, Code} = req.body
  const url = `https://openapi.baidu.com/oauth/2.0/token?grant_type=authorization_code&code=${Code}&client_id=${AppKey}&client_secret=${SecretKey}&redirect_uri=${auth.redirect_uri}`
  const accessTokenResult = await getAccessToken()
  if (!accessTokenResult?.error) {
    postResult.error = false
    await writeJson(accessTokenResult)
  } else {
    await writeJson({
      AppKey, SecretKey, Code
    })
  }
  postResult.msg = accessTokenResult
  
  // 写入token到auth.json
  function writeJson(data) {
    const jsonPath = path.join(path.resolve(), 'auth.json')
    return new Promise(resolve => {
      // 是否存在json文件
      const exist = isExist(jsonPath)
      let jsonData
      if (exist) { // 存在则引入
        jsonData = toolsReadFile(jsonPath)
        Object.keys(data).forEach(k => {
          if (data[k]) jsonData[k] = data[k]
        })
      } else {
        jsonData = data
      }
  
      console.log(jsonData)
      
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
  const jsonPath = path.join(path.resolve(), 'auth.json')
  // 是否存在json文件
  const exist = isExist(jsonPath)
  let jsonData
  if (exist) {
    jsonData = toolsReadFile(jsonPath)
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
  const {filePath, isDir} = req.query
  await openExplorer(req.headers?.useruk, filePath, isDir)
  res.send('success')
})

// 删除本地文件
routerApi.get('/deleteFiles', async (req, res) => {
  const filePathList = req.query.filePathList
  const result = deleteFiles(filePathList)
  res.send(result)
})

// 查看未完成的任务
routerApi.get('/undoneList', async (req, res) => {
  const filePath = taskFilename(req.headers.useruk)
  const result = toolsReadFile(filePath) || {}
  res.send(result)
})

// 删除已下载的文件
routerApi.get('/deleteDownload', async (req, res) => {
  const files = req.query.list
  const uk = req.headers?.useruk
  const result = await deleteDownload(uk, files).catch(err => console.log(err))
  res.send(result)
})

// 记录下载任务
routerApi.post('/recordTasks', async (req, res) => {
  await handleRecordTasks(req.body.list, req.headers?.useruk, 'write')
  res.send(toolsReadFile(path.join(path.resolve(), `download/tasks_${req.headers?.useruk}.json`)))
})

// proxy https版本
routerApi.get('/proxy', async (req, res) => {
  const {
    url,
    params = '{}',
    method = 'get',
    mergeHeaders = '0',
    headers = {
      'User-Agent': 'pan.baidu.com'
    }
  } = req.query
  
  // 解析url中的headers
  let tempHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers
  
  // 是否合并浏览器请求头
  if (mergeHeaders === '1') {
    const reqHeaders = req.headers
    delete reqHeaders.referer
    delete reqHeaders.origin
    delete reqHeaders.host
    tempHeaders = Object.assign(reqHeaders, tempHeaders)
  }
  
  if (method === 'get') {
    // res.send(await get(req))
    axios.get(
        url,
        {
          params: JSON.parse(params),
          headers: tempHeaders
        }
    ).then(response => {
      if (typeof response.data === 'string') { // 返回的数据是字符串,则设置标头
        res.writeHead(response.status, response.headers)
        res.end(response.data)
      } else { // 返回的数据是对象,直接返回json数据
        res.json(response.data)
      }
    }).catch(err => {
      res.json(err.toJSON())
      console.error(err, {
        url,
        params: JSON.parse(params),
        headers: tempHeaders
      })
    })
  } else if (method === 'post') {
    res.send(await fileManagerPost(req))
  }
})

// 文件操作专属方法
function fileManagerPost(req) {
  return new Promise(resolve => {
    const {
      url,
      params,
      headers = {
        "User-Agent": "pan.baidu.com",
        "content-type": "application/x-www-form-urlencoded" // json不行
      }
    } = req.query
    
    const {filelist, async = 0} = JSON.parse(params)
    
    let filelistStr = ''
    
    filelist.forEach((v, k) => {
      filelistStr += `${k === 0 ? '' : ','}"${v}"`
    })
    
    // 未编码前
    // console.log({filelist: `[${filelistStr}]`, async})
    
    axios
        .post(url, querystring.stringify({
          filelist: `[${filelistStr}]`,
          async
        }), {headers})
        .then(({data}) => {
          if (data.errno === 0) {
            resolve({
              error: false,
              info: data.info
            })
          } else {
            resolve({
              error: true,
              info: data
            })
          }
        })
        .catch(res => {
          resolve({
            error: true,
            info: res
          })
        })
    
  })
}

/**
 * 代理
 * url 代理的url
 * headers 需要添加的头部
 * mergeHeaders 是否合并浏览器请求头部
 */
routerApi.get('/rawProxy', async (req, res) => {
  const {url, headers = '{}', mergeHeaders = '0'} = req.query
  // 解析url中的headers
  let tempHeaders = typeof headers === 'string' ? JSON.parse(headers) : headers
  // 是否合并浏览器请求头
  if (mergeHeaders === '1') {
    const reqHeaders = req.headers
    delete reqHeaders.referer
    delete reqHeaders.origin
    delete reqHeaders.host
    tempHeaders = Object.assign(reqHeaders, tempHeaders)
  }
  // fetch
  fetch(url, {
    method: 'GET',
    headers: tempHeaders
  })
      .then(async response => {
        for await (const chunk of response.body) {
          res.write(chunk)
        }
        res.end()
      })
      .catch(e => console.log(e, req))
})

module.exports = routerApi


