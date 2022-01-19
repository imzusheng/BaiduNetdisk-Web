const WsServer = require('quick-ws-server')
const https = require("https")
const path = require('path')
const {
  writeDownload,
  handleRecordTasks,
  toolsReadFile,
  getFileRange
} = require('./util')

// process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'


const qws = new WsServer({port: 3102}) // 启动WebSocket，端口3102

// 创建代理对象
function createProxy(ws, uk) {
  const get = (obj, curIndex) => obj[curIndex] // 无操作get
  const set = (obj, curIndex, newVal) => {
    obj[curIndex] = newVal
    return true
  } // 无操作set
  const deleteProperty = (target, p) => { // delete做了拦截
    delete target[p]
    const surplusTask = Object.values(target).filter(task => task.status === 'pause')
    if (surplusTask.length > 0) { // 删除之后仍有其他任务
      downloadOnce(ws, uk, surplusTask[0])
    }
  }
  return new Proxy({}, {get, set, deleteProperty})
}

/**
 * 第一步get请求,重定向
 * 成功返回下载链接
 * @param ws
 * @param dlink
 * @return {Promise<url|null>}
 */
function getFirstStep(ws, dlink) {
  return new Promise(resolve => {
    https.get(dlink + `&access_token=${ws.access_token}`, {
      headers: {'User-Agent': 'pan.baidu.com'}
    }, dlinkRes => {
      let str = ''
      dlinkRes.on('data', res => str += res)
      dlinkRes.on('end', () => {
        // 302重定向，重定向链接为headers.location
        const result = dlinkRes.headers.location ?
            dlinkRes.headers.location.replace('http', 'https') : null
        if (!result) console.log(JSON.parse(str)) // 报错了 输出一下错误
        resolve(result)
      })
    })
  })
}

/**
 *  第二次请求: 获取资源，开始下载
 * @param ws
 * @param url
 * @param taskInfo
 */
function getSecondStep(ws, url, taskInfo) {
  
  const {path: filePath, fsid, total, filename} = taskInfo
  const {uk, incomingMessageList, downloadTasksList, writeStreamList} = ws
  
  const range = getFileRange(uk, filePath) || 0 // 下载起始位置
  
  // 对重定向链接发起下载请求
  https.get(url + `&access_token=${ws.access_token}`, {
    headers: {
      'User-Agent': 'pan.baidu.com',
      'Range': `bytes=${range}-`
    },
  }, async response => {
    
    const wd = await writeDownload(uk, taskInfo) // 打开写入流
    let curFileSize = range // 当前下载的大小
    incomingMessageList[fsid] = response
    writeStreamList[fsid] = wd
    
    // 收到数据块
    response.on('data', chunk => {
      if (!ws.online) {
        wd.end()
        response.destroy()
        return
      }
      wd.write(chunk) // 开始写入  如果需要直接转发资源，使用Buffer.from(chunk).buffer转换为ArrayBuffer
      curFileSize += chunk.length // 记录当前数据大小，用来计算下载进度
      ws.send(JSON.stringify({
        fsid,
        total,
        filename,
        curFileSize,
        status: 'run',
        type: 'chunk',
        progress: (curFileSize / total * 100).toFixed(2)
      }))  // 回传当前的下载进度到前端
    })
    
    // 下载结束标记
    response.on('end', () => {
      handleRecordTasks({fsid}, uk, 'delete')
      delete incomingMessageList[fsid] // 删除下载队列信息.1
      delete writeStreamList[fsid] // 删除下载队列信息.2
      delete downloadTasksList[fsid] // 删除下载队列信息.3
      ws.send(JSON.stringify({  // 回复下载结束标记
        fsid,
        filename,
        type: 'end'
      }))
      wd.end() // 文件写入结束
    })
    
  })
}

// 处理下载一个任务的请求
function downloadOnce(ws, uk, taskInfo) {
  ws.downloadTasksList[taskInfo.fsid].status = 'run' // 已经开始的任务做一个标记,(方便在deleteProperty中识别)以免重复下载
  try {
    getFirstStep(ws, taskInfo.dlink).then(url => {
      if (ws.online) getSecondStep(ws, url, taskInfo)
    })
  } catch (e) {
    console.log(e)
  }
}

qws.on('message', async (ws, data) => {
  const {
    uk,           // 百度网盘用户ID
    type,         // 请求类型
    sum = 2,      // 并行下载数量
    accessToken   // 令牌
  } = JSON.parse(data)
  
  
  ws.online = true
  
  if (!ws?.uk || !ws.access_token) { // 这个客户端第一次发消息过来,欢迎一下
    ws.uk = uk
    ws.access_token = accessToken
    ws.pathDownload = path.join(path.resolve(), `download/${uk}`) // 客户端的专属下载路径
    ws.pathRecords = path.join(path.resolve(), `download/tasks_${uk}.json`) // 客户端记录下载任务的json文件路径
    
    ws.incomingMessageList = {} // 主要作用是可以随时暂停任务, 保存正在下载状态的https incomingMessage
    ws.downloadTasksList = createProxy(ws, uk)// Proxy 保存未开始的任务,下载完一个删除一个
    ws.writeStreamList = {}
  }
  
  console.log(`客户端 ${ws.uk} 发来一条消息,类型:${type}`, JSON.parse(data))
  
  // if (type === 'download') { // 确认为下载请求
  //
  //   // 当前下载进度，请求头headers.Range
  //   const Range = getFileRange(uk, fsid, fn) || 0
  //
  //   // 打开dlink,等待重定向
  //   https.get(url, dlinkRes => {
  //
  //     // 302重定向，重定向链接为headers.location
  //     if (dlinkRes.headers.location) {
  //
  //       // 替换为https
  //       const redirectUrl = dlinkRes.headers.location.replace('http', 'https')
  //
  //       // ws.on('close', () => {}) 连接关闭后, 这里关闭多次是因为每次https都会监听一次close, 相当于下载一个文件就一个连接
  //       https.get(redirectUrl, {headers: {Range: `bytes=${Range}-`}}, async response => {
  //         /**
  //          * 解决content-disposition中文乱码！！！
  //          * 执行前：filename="AE Pr è¿å¨æ¨¡ç³æä»¶RSMB Reel Smart Motion Blur Pro v5.0.zip"
  //          * 执行后：filename="AE Pr 运动模糊插件RSMB Reel Smart Motion Blur Pro v5.0.zip"
  //          */
  //         const contentDispositionUri = decodeURIComponent(escape(response.headers['content-disposition']))
  //         /**
  //          * decodeURI执行前：filename="Win11+%E5%A3%81%E7%BA%B8.zip"
  //          * decodeURI执行后: filename="Win11+壁纸.zip"
  //          */
  //         const contentDisposition = decodeURI(contentDispositionUri)
  //
  //         // 过滤出文件名 文件名
  //         const filename = contentDisposition
  //             .substring(contentDisposition.indexOf('filename=') + 'filename='.length)
  //             .replace(/"/g, '')
  //             .replace(/\+/g, ' ')
  //         // 文件总大小
  //         const fileSize = parseInt(response.headers['content-length']) + Range
  //         // 封装创建写入流
  //         const wf = await writeFile(uk, filename, fsid)
  //         // 当前下载的大小
  //         let curFileSize = Range
  //
  //         // 收到数据块
  //         response.on('data', chunk => {
  //           // 记录当前数据大小，用来计算下载进度
  //           curFileSize += chunk.length
  //           // 回传当前的下载进度到前端
  //           const progressInfo = {
  //             progress: (curFileSize / fileSize * 100).toFixed(2),
  //             curFileSize,
  //             total: fileSize,
  //             filename,
  //             fsid,
  //             status: 'run',
  //             type: 'chunk'
  //           }
  //           // 发送到前端
  //           ws.send(JSON.stringify(progressInfo))
  //           // 服务器存一份，改状态为pause
  //           progressInfo.status = 'pause'
  //           downloadQueue[fsid] = progressInfo
  //           // 如果需要直接转发资源，使用Buffer.from(chunk).buffer转换为ArrayBuffer
  //           // 开始写入
  //           wf.write(chunk)
  //         })
  //
  //         // 下载结束标记
  //         response.on('end', () => {
  //           // 删除下载未完成的日志
  //           deleteLogFile(fsid)
  //           // 删除响应的下载队列信息
  //           delete downloadQueue[fsid]
  //           // 回复下载结束标记
  //           ws.send(JSON.stringify({
  //             filename: fn,
  //             fsid,
  //             type: 'end'
  //           }))
  //           // fs.WriteStream.close 一般来说会自动关闭
  //           wf.close()
  //         })
  //
  //         // 添加到队列
  //         incomingMessageList[fsid] = {
  //           response,
  //           fn,
  //           fsid,
  //           status: 'none'
  //         }
  //
  //       })
  //     }
  //   })
  // } else if (type === 'pause') { // 确认为暂停下载请求
  //   // 结束请求
  //   incomingMessageList[fsid].response.destroy() // 暂停下载
  //   delete incomingMessageList[fsid] // 删除任务
  //   await handleRecordTasks(downloadQueue, uk, 'write') // 保存进度到json日志
  //   ws.send(JSON.stringify({ // 回复敷衍一下
  //     type: 'pause',
  //     fsid
  //   }))
  // }
  
  if (type === 'startDownload') {  // 触发所有任务下载
    const jsonObj = toolsReadFile(ws.pathRecords) // 读取待下载列表
    Object.assign(ws.downloadTasksList, jsonObj) // 全都合并到响应式队列
    // 提取出最大并发数量的任务,如最大并发数为5则提取五个任务出来先. 执行downloadOnce开始下载这个任务
    Object.keys(jsonObj).slice(0, sum).forEach(k => downloadOnce(ws, uk, jsonObj[k]))
  }
  
  // 客户端退出,保存下载进度
  ws.on('close', () => {
    console.log(`客户端 ${ws.uk} 退出`)
    ws.online = false // 客户端退出需要打上标记,有些请求进行到第一步时incomingMessageList还没有response所以需要利用online标识来拦截
    Object.values(ws.incomingMessageList).forEach(response => response.destroy()) // 销毁所有下载请求
    Object.values(ws.writeStreamList).forEach(writeStream => writeStream.close()) // 销毁所有写入流,暂停写入
    const undoneList = Object.values(ws.downloadTasksList).filter(task => task.status === 'run') // 只保留下载中的任务
    undoneList.forEach(task => {
      task.curFileSize = ws.writeStreamList[task.fsid]?.bytesWritten ?? 0
      task.progress = (task.curFileSize / task.total * 100).toFixed(2) // 计算百分比
      task.status = 'pause' // 回复暂停状态
    })
    handleRecordTasks(undoneList, ws.uk, 'write')
  })
})
