const WsServer = require('quick-ws-server')
const https = require("https")
const {writeFile, writeLogFile, getFileRange, deleteLogFile} = require('./util')

// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

// 启动WebSocket，端口3102
const qws = new WsServer({port: 3102})

/**
 * 主要作用是可以随时暂停任务
 * 正在下载状态的https incomingMessage 如：
 * {
 *    [fsid]: {
 *          response,       // incomingMessage
 *          fn,             // 文件名
 *          fsid,           // 文件id
 *          status: 'none'  // 当前状态
 *    }
 * }
 */
const incomingMessageList = new Proxy({}, {
  get: function (obj, prop) {
    return obj[prop]
  },
  set: (obj, prop, newVal) => {
    obj[prop] = newVal
  }
})
/**
 * 主要作用是保存下载进度，频繁更新所以不写入json，暂停时才写入
 * 下载队列信息如：
 * {
 *     progress: (curFileSize / fileSize * 100).toFixed(2),
 *     curFileSize,
 *     total: fileSize,
 *     filename,
 *     fsid,
 *     status: 'pause', // 一直都为pause,因为只有任务暂停了才会被写入json，其余时间对程序运行无影响
 *     type: 'chunk'
 * }
 */
let downloadQueue = {}

qws.on('message', (ws, data) => {
  const {
    type,         // 请求类型
    url,          // 代理下载url
    uk,           // 百度网盘用户ID
    fsid,         // 文件唯一ID
    filename: fn  // 文件名 别名fn
  } = JSON.parse(data)
  
  if (type === 'download') { // 确认为下载请求
    
    // 当前下载进度，请求头headers.Range
    const Range = getFileRange(uk, fsid, fn) || 0
    
    // 打开dlink,等待重定向
    https.get(url, dlinkRes => {
      
      // 302重定向，重定向链接为headers.location
      if (dlinkRes.headers.location) {
        
        // 替换为https
        const redirectUrl = dlinkRes.headers.location.replace('http', 'https')
        
        // ws.on('close', () => {}) 连接关闭后, 这里关闭多次是因为每次https都会监听一次close, 相当于下载一个文件就一个连接
        https.get(redirectUrl, {headers: {Range: `bytes=${Range}-`}}, async response => {
          /**
           * 解决content-disposition中文乱码！！！
           * 执行前：filename="AE Pr è¿å¨æ¨¡ç³æä»¶RSMB Reel Smart Motion Blur Pro v5.0.zip"
           * 执行后：filename="AE Pr 运动模糊插件RSMB Reel Smart Motion Blur Pro v5.0.zip"
           */
          const contentDispositionUri = decodeURIComponent(escape(response.headers['content-disposition']))
          /**
           * decodeURI执行前：filename="Win11+%E5%A3%81%E7%BA%B8.zip"
           * decodeURI执行后: filename="Win11+壁纸.zip"
           */
          const contentDisposition = decodeURI(contentDispositionUri)
          
          // 过滤出文件名 文件名
          const filename = contentDisposition
              .substring(contentDisposition.indexOf('filename=') + 'filename='.length)
              .replace(/"/g, '')
              .replace(/\+/g, ' ')
          // 文件总大小
          const fileSize = parseInt(response.headers['content-length']) + Range
          // 封装创建写入流
          const wf = await writeFile(uk, filename, fsid)
          // 当前下载的大小
          let curFileSize = Range
          
          // 收到数据块
          response.on('data', chunk => {
            // 记录当前数据大小，用来计算下载进度
            curFileSize += chunk.length
            // 回传当前的下载进度到前端
            const progressInfo = {
              progress: (curFileSize / fileSize * 100).toFixed(2),
              curFileSize,
              total: fileSize,
              filename,
              fsid,
              status: 'run',
              type: 'chunk'
            }
            // 发送到前端
            ws.send(JSON.stringify(progressInfo))
            // 服务器存一份，改状态为pause
            progressInfo.status = 'pause'
            downloadQueue[fsid] = progressInfo
            // 如果需要直接转发资源，使用Buffer.from(chunk).buffer转换为ArrayBuffer
            // 开始写入
            wf.write(chunk)
          })
          
          // 下载结束标记
          response.on('end', () => {
            // 删除下载未完成的日志
            deleteLogFile(fsid)
            // 删除响应的下载队列信息
            delete downloadQueue[fsid]
            // 回复下载结束标记
            ws.send(JSON.stringify({
              filename: fn,
              fsid,
              type: 'end'
            }))
            // fs.WriteStream.close 一般来说会自动关闭
            wf.close()
          })
          
          // 添加到队列
          incomingMessageList[fsid] = {
            response,
            fn,
            fsid,
            status: 'none'
          }
          
        })
      }
    })
  } else if (type === 'pause') { // 确认为暂停下载请求
    // 结束请求
    incomingMessageList[fsid].response.destroy()
    // 删除任务信息
    delete incomingMessageList[fsid]
    // 保存进度到json日志
    writeLogFile(downloadQueue)
    // 回复敷衍一下
    ws.send(JSON.stringify({
      type: 'pause',
      fsid
    }))
  }
  
  console.log(ws.id, JSON.parse(data))
})


// 传输中途断开websocket，保存进度到json日志
qws.on('close', () => {
  console.log('qws - close')
  // 保存进度到json日志
  writeLogFile(downloadQueue)
  // 清空下载中的信息
  downloadQueue = {}
})
