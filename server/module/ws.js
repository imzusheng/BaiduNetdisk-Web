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

// 启动WebSocket，端口3102
const qws = new WsServer({port: 3102})

/**
 * 创建代理对象
 * @param ws 客户端对象
 * @param uk 客户端id
 * @return {Object} Proxy对象
 */
function createProxy(ws, uk) {
  const get = (obj, curIndex) => obj[curIndex] // 无操作get
  const set = (obj, curIndex, newVal) => {
    obj[curIndex] = newVal
    return true
  } // 无操作set
  const deleteProperty = (target, p) => { // delete做了拦截
    delete target[p]
    // 只取状态为暂停的任务
    const surplusTask = Object.values(target).filter(task => task.status === 'pause')
    // 删除之后仍有其他任务 且 下载中的任务不超过最大并发任务数量
    if (surplusTask.length > 0 && Object.keys(ws.downloadTasksList).length <= ws.sum) {
      downloadOnce(ws, uk, surplusTask[0])
    }
  }
  return new Proxy({}, {get, set, deleteProperty})
}

qws.on('message', async (ws, data) => {
  const {
    uk,           // 百度网盘用户ID
    type,         // 请求类型
    fsid = null,  // 请求操作的fsid
    dlink = null, // 下载链接
    sum = 2,      // 并行下载数量
    accessToken   // 令牌
  } = JSON.parse(data)
  
  if (!ws?.uk) { // 这个客户端第一次发消息过来,欢迎一下
    ws.online = true // 设置在线状态
    ws.uk = uk
    ws.sum = sum
    ws.access_token = accessToken
    ws.pathDownload = path.join(path.resolve(), `download/${uk}`) // 客户端的专属下载路径
    ws.pathRecords = path.join(path.resolve(), `download/tasks_${uk}.json`) // 客户端记录下载任务的json文件路径
    
    ws.incomingMessageList = {} // 主要作用是可以随时暂停任务, 保存正在下载状态的https incomingMessage(https response)
    ws.downloadTasksList = createProxy(ws, uk)// Proxy 保存未开始的任务,下载完一个删除一个
    ws.writeStreamList = {}
    const jsonObj = toolsReadFile(ws.pathRecords) // 读取待下载列表
    Object.assign(ws.downloadTasksList, jsonObj) // 全都合并到响应式队列
  }
  
  if (fsid) ws.fsid = fsid
  if (dlink) ws.dlink = dlink
  
  console.log(`客户端 ${ws.uk} 发来一条消息,类型:${type}`, JSON.parse(data))
  
  const route = { // 函数路由器
    startDownload,
    pauseDownload,
    startOneTask,
    pauseOneTask
  }
  
  if (['startDownload', 'pauseDownload', 'startOneTask', 'pauseOneTask'].includes(type)) route[type](ws) // 执行对应的方法
  
  // 客户端退出,保存下载进度
  ws.on('close', () => {
    ws.online = false // 客户端退出需要打上标记,在getSecondStep中拦截
    console.log(`客户端 ${ws.uk} 退出`)
  })
})

/**
 * route 开始所有任务
 * @param ws 客户端对象
 */
function startDownload(ws) {
  // 提取出最大并发数量的任务,如最大并发数为5则提取五个任务出来先. 执行downloadOnce开始下载这个任务
  Object.keys(ws.downloadTasksList).slice(0, ws.sum).forEach(k => downloadOnce(ws, ws.uk, ws.downloadTasksList[k]))
}

/**
 * 执行 下载一个任务 分两步getFirstStep,getSecondStep
 * @param ws
 * @param uk
 * @param taskInfo
 */
function downloadOnce(ws, uk, taskInfo) {
  ws.downloadTasksList[taskInfo.fsid].status = 'run' // 已经开始的任务做一个标记,(方便在deleteProperty中识别)以免重复下载
  try {
    getFirstStep(ws, taskInfo.dlink).then(url => {
      getSecondStep(ws, url, taskInfo)
    })
  } catch (e) {
    console.log(e)
  }
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
        if (!result) {
          try {
            console.log(JSON.parse(str))
          } catch (e) {
            console.log(e, str)
          }
          // 报错了 输出一下错误
        }
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
      if (!ws.online) { // 反应到客户端已经关闭
        wsClientClose(ws)
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

/**
 * route 暂停所有任务
 * @param ws
 */
function pauseDownload(ws) {
  ws.online = false // 客户端退出需要打上标记,在getSecondStep中拦截
}

/**
 * 开始一个任务
 * @param ws 客户端对象
 */
function startOneTask(ws) {
  ws.downloadTasksList[ws.fsid].dlink = ws.dlink // 最新的dlink TODO 后期把获取文件详细信息的请求交给服务器直接发送，反正前后端工作量哪个大都是自己做的
  downloadOnce(ws, ws.uk, ws.downloadTasksList[ws.fsid])
}

/**
 * 暂停一个任务
 * @param ws 客户端对象
 * @return {Promise<void>}
 */
async function pauseOneTask(ws) {
  const {incomingMessageList, downloadTasksList, writeStreamList, uk, fsid} = ws
  try {
    incomingMessageList[fsid].response.destroy() // 暂停下载
    delete ws.incomingMessageList[fsid] // 删除任务
    writeStreamList[fsid].close() // 暂停写入
    delete writeStreamList[fsid] // 删除 writeStream
    await handleRecordTasks([downloadTasksList[fsid]], uk, 'write') // 保存进度到json日志
    delete downloadTasksList[fsid]
  } catch (e) {
    console.log(e)
  }
  ws.send(JSON.stringify({ // 回复敷衍一下
    type: 'pause',
    fsid
  }))
}

/**
 * 客户端关闭前
 * 1. 取消下载
 * 2. 关闭写入流
 * 3. 保存下载进度信息
 * @param ws 客户端对象
 */
function wsClientClose(ws) {
  Object.values(ws.incomingMessageList).forEach(response => response.destroy()) // 销毁所有下载请求
  Object.values(ws.writeStreamList).forEach(writeStream => writeStream.close()) // 销毁所有写入流,暂停写入
  const undoneList = Object
      .values(ws.downloadTasksList)
      .filter(task => task.status === 'run') // 只保留下载中的任务
      .map(task => {
        task.curFileSize = ws.writeStreamList[task.fsid]?.bytesWritten ?? 0
        task.progress = (task.curFileSize / task.total * 100).toFixed(2) // 计算百分比
        task.status = 'pause' // 回复暂停状态
        return task
      })
  handleRecordTasks(undoneList, ws.uk, 'write').then()
  ws = null
}
