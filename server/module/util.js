const fs = require('fs')
const path = require('path')
const {exec} = require("child_process");

// 下载文件夹download的根路径
const downloadPath = path.join(path.resolve(), 'download')
// 用户的下载文件夹路径
const userDownloadPath = uk => path.join(downloadPath, uk)
// 保存下载任务的json文件名
const taskFilename = uk => path.join(downloadPath, `tasks_${uk}.json`)

/**
 * 文件是否存在
 * @param path 文件路径
 * @return {boolean} true 存在, false 不存在
 */
const isExist = path => {
  try {
    fs.accessSync(path, fs.constants.R_OK | fs.constants.W_OK)
    return true
  } catch (err) {
    return false
  }
}

/**
 * @param uk 用户ID
 * @param taskInfo 下载任务的信息
 * @return {Promise<WriteStream>}
 */
const writeDownload = async (uk, taskInfo) => {
  const {path: filePath, filename} = taskInfo
  const userPath = userDownloadPath(uk.toString()) // 用户文件夹
  const noFilenamePath = path.join(userPath, filePath.replace(`/${filename}`, ''))// (不包含文件名)
  // 文件路径是否存在，不存在则创建
  if (!isExist(noFilenamePath)) await mkdirMultiple(noFilenamePath)
  const fullPath = path.join(userPath, filePath) // 完整路径(包含文件名)
  return new Promise(resolve => {
    const writeStream = fs.createWriteStream(fullPath, {
      flags: 'a+'
    })
    writeStream.once('ready', () => resolve(writeStream))
  })
}

/**
 * 创建多层级目录
 * @param filepath 'C:\Users\Yello\Desktop\webProject\web-baidu\server\download'
 * @return {Promise<*|boolean>}
 */
const mkdirMultiple = async filepath => {
  const pathArr = filepath.split('\\')
  let index = 2
  try {
    return await mkdir(path.join(pathArr[0], pathArr[1]))
  } catch (e) {
    console.log(e)
  }
  
  async function mkdir(curFilePath) {
    const exist = isExist(curFilePath)
    if (!exist) fs.mkdirSync(curFilePath)
    if (index < pathArr.length) {
      const nextPath = pathArr[index++]
      return await mkdir(path.join(curFilePath, nextPath))
    } else {
      return true
    }
  }
}

/**
 * 列出本地下载目录的文件
 * @param uk 用户ID
 * @return {Promise<array>} 返回目录中所有文件信息
 */
const listLocalFiles = async uk => {
  
  const fileInfoList = []
  
  const filepath = path.join(path.resolve(), `download/${uk}`)
  if (!isExist(filepath)) await mkdirMultiple(filepath)
  listFilesInfo(filepath)
  
  // 列出目录中所有文件名(深度遍历)
  function listFilesInfo(filepath) {
    // 获取目录下所有文件或文件夹名字
    const fileList = fs.readdirSync(filepath)
    fileList.forEach(filename => { // 根据文件名查询文件信息
      // 确保文件存在
      if (!isExist(path.join(filepath, filename))) return
      // 文件所在完整路径(包含文件名或文件夹名)
      const fullPath = path.join(filepath, filename)
      // 查询文件信息
      const fileStat = fs.statSync(fullPath)
      if (fileStat.isDirectory()) { // 文件名是目录时,继续遍历
        listFilesInfo(fullPath)
      } else {
        const {size, birthtimeMs} = fileStat
        const fileExt = path.extname(filename)
        fileInfoList.push({
          size,
          filename,
          path: fullPath,
          relativePath: fullPath.replace(path.join(path.resolve(), `download/${uk}`), ''),
          ext: fileExt,
          birthtimeMs: birthtimeMs.toFixed(0)
        })
      }
    })
  }
  
  return fileInfoList
}

/**
 *
 * @param uk 网盘用户ID
 * @param filePath
 * @return {number|null} number为Range
 */
const getFileRange = (uk, filePath) => {
  // 判断用户文件夹是否存在
  const filepath = path.join(path.resolve(), `download/${uk}`, filePath)
  const exist = isExist(filepath)
  // 根据文件名查询文件信息
  return exist ? fs.statSync(filepath).size : null
}

/**
 * exec 打开本地目录
 * @param uk 用户ID命名的专属文件夹
 * @param filePath 文件路径
 * @param isDir 是否是文件夹
 * @return {Promise<void>}
 */
const openExplorer = async (uk, filePath, isDir) => {
  const tFilePath = filePath ? filePath : userDownloadPath(uk)
  let command
  if (isDir) {
    command = `explorer.exe /select,"${tFilePath}"`
  } else {
    if (!isExist(tFilePath)) await mkdirMultiple(tFilePath)
    command = `explorer.exe "${tFilePath}"`
  }
  exec(command)
}

/**
 * 同步删除文件
 * @return {boolean} true 删除成功
 * @param filePathList
 */
const deleteFiles = (filePathList) => {
  for (let i = 0; i < filePathList.length; i++) {
    const filePath = filePathList[i]
    console.log(filePath)
    if (filePath) {
      const exist = isExist(filePath)
      // 文件存在， 删除
      if (exist) fs.rmSync(filePath)
    }
  }
  return true
}

/**
 * @param {Array|{fsid}} taskInfo
 * @param uk
 * @param type
 * @return {Promise<void>}
 */
const handleRecordTasks = async (taskInfo, uk, type) => {
  if (!isExist(downloadPath)) await mkdirMultiple(downloadPath) // 下载目录不存在则创建
  
  const jsonData = {}
  const filePath = taskFilename(uk) // 记录下载任务的文件名(用户uk命名)
  if (isExist(filePath)) Object.assign(jsonData, toolsReadFile(filePath))
  
  if (type === 'delete') { // 删除待下载文件，ws下载完成后调用
    delete jsonData[taskInfo.fsid]
  } else if (type === 'write') { // 写入待下载文件，用户专属。 recordTasks路由调用
    taskInfo.forEach(task => jsonData[task.fsid] = task)
    console.log('写入', jsonData)
  }
  
  fs.writeFileSync(filePath, JSON.stringify(jsonData), {flag: 'w+', encoding: 'utf-8'})
}

// 删除下载任务
const deleteDownload = (uk, files) => {
  return new Promise(resolve => {
    const filesParse = files.map(v => typeof v === 'string' ? JSON.parse(v) : v)
    // 删除文件本身
    const filePathList = filesParse.map(fileInfo => path.join(path.resolve(), `download/${uk}/`, fileInfo.path))
    deleteFiles(filePathList)
    // tasks_uk.json文件的路径
    const taskFilePath = taskFilename(uk)
    let jsonData = {}
    if (isExist(taskFilePath)) { // tasks_uk.json文件存在, 这里只是删除json的待下载文件信息
      jsonData = toolsReadFile(taskFilePath)
      filesParse.forEach(fileInfo => {
        delete jsonData[fileInfo.fsid]
      })
      // 写入回去
      fs.writeFile(taskFilePath, JSON.stringify(jsonData), 'utf8', err => {
        if (err) {
          console.log(err)
          resolve(false)
        }
        resolve(true)
      })
    } else {
      resolve(false)
    }
  })
}

/**
 * 简单的读取文件,json文件自动parse
 * @param filePath
 * @return {string|null}
 */
const toolsReadFile = filePath => {
  if (!isExist(filePath)) return null
  const result = fs.readFileSync(filePath, {encoding: 'utf-8'})
  return path.extname(filePath) === '.json' ? JSON.parse(result) : result
}

/**
 * 节流throttle
 */
const throttle = (fn, delay) => {
  let lastTime = Date.now()
  return function (msg) {
    const curTime = Date.now()
    if (curTime - lastTime > delay) {
      lastTime = curTime
      fn(msg)
    }
  }
}

module.exports = {
  isExist,
  deleteFiles,
  getFileRange,
  taskFilename,
  openExplorer,
  toolsReadFile,
  writeDownload,
  listLocalFiles,
  deleteDownload,
  handleRecordTasks,
  throttle
}
