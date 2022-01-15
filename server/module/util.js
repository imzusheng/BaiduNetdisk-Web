const fs = require('fs')
const path = require('path')
const {exec} = require("child_process");

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
 * @param filename 传入文件名
 * @param fsid 文件唯一ID 加入到文件名
 * @return {Promise<WriteStream>}
 */
const writeFile = async (uk, filename, fsid) => {
  const filepath = path.join(__dirname, `../download/${uk}`)
  // 处理文件名
  const {filename: newFilename} = filenameHandle(filename, fsid.toString(), 'input')
  // 完整路径
  const fullPath = path.join(filepath, newFilename)
  // 文件是否存在
  const exist = isExist(filepath)
  // 不存在则创建
  if (!exist) await mkdirMultiple(filepath)
  return new Promise(resolve => {
    const writeStream = fs.createWriteStream(fullPath, {
      flags: 'a+',
      autoClose: true
    })
    resolve(writeStream)
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
 * 转换文件名, 写入的文件名加入了_fsid_需要去除
 * @param filename 文件名
 * @param fsid 文件ID
 * @param type input为写入，加入fsid/ output为读取，去除fsid
 */
function filenameHandle(filename, fsid, type) {
  // 取文件后缀名
  const fileExt = path.extname(filename)
  if (type === 'input') {
    // 将文件fsid加入到文件名后缀前
    const newFilename = filename.replace(new RegExp(`${fileExt}$`), `_fsid_${fsid + '' + fileExt}`)
    return {
      filename: newFilename
    }
  } else if (type === 'output') {
    // 取fsid， 处理后格式_fsid_123456
    const fsidExt = filename.substring(filename.lastIndexOf('_fsid_'), filename.lastIndexOf(fileExt))
    // 源文件名，只要替换掉_fsid_123456部分
    const rawFilename = filename.replace(fsidExt, '')
    // fsid，去除字符串"_fsid_"
    const fsid = fsidExt.replace('_fsid_', '')
    return {
      filename: rawFilename,
      fsid,
      fileExt
    }
  }
}

/**
 * 列出本地下载目录的文件
 * @param uk 用户ID
 * @return {Promise<array>} 返回目录中所有文件信息
 */
const listLocalFiles = uk => {
  return new Promise(resolve => {
    const filepath = path.join(__dirname, `../download/${uk}`)
    // 列出目录中所有文件名
    fs.readdir(filepath, (err, fileList) => {
      const fileInfoList = []
      if (!err) {
        // 遍历文件名
        fileList.forEach(filename => {
          const exist = isExist(path.join(filepath, filename))
          // 根据文件名查询文件信息
          const fileStat = exist ? fs.statSync(path.join(filepath, filename)) : null
          // 文件存在， 因为可能文件就在刚刚被删掉了， 确保不会报错
          if (fileStat !== null) {
            const {size, birthtimeMs} = fileStat
            // 下面对filename特殊处理去除fsid
            const {filename: rawFilename, fsid, fileExt} = filenameHandle(filename, null, 'output')
            fileInfoList.push({
              size,
              fsid,
              filename,
              ext: fileExt,
              rawFilename,
              birthtimeMs: birthtimeMs.toFixed(0)
            })
          }
        })
      }
      resolve(fileInfoList)
    })
  })
}

/**
 *
 * @param uk 网盘用户ID
 * @param fsid 文件唯一ID
 * @param filename 文件名
 * @return {number|null} number为Range
 */
const getFileRange = (uk, fsid, filename) => {
  // 判断用户文件夹是否存在
  const filepath = path.join(__dirname, `../download/${uk}`)
  const {filename: newFilename} = filenameHandle(filename, fsid, 'input')
  const exist = isExist(path.join(filepath, newFilename))
  // 根据文件名查询文件信息
  return exist ? fs.statSync(path.join(filepath, newFilename)).size : null
}

/**
 * exec 打开本地目录
 * @param uk 用户ID命名的专属文件夹
 * @param filename 文件名
 * @return {Promise<void>}
 */
const openExplorer = async (uk, filename) => {
  let filePath
  let command
  if (filename) {
    filePath = path.join(__dirname, `../download/${uk}/` + filename)
    command = `explorer.exe /select,"${filePath}"`
  } else {
    await mkdirMultiple(path.join(__dirname, `../download/${uk}`))
    filePath = path.join(__dirname, `../download/${uk}`)
    command = `explorer.exe "${filePath}"`
  }
  exec(command)
}

/**
 * 同步删除文件
 * @param uk 用户ID
 * @param {array} filenames 文件名数组
 * @return {boolean} true 删除成功
 */
const deleteFiles = (uk, filenames) => {
  console.log(filenames)
  for (let i = 0; i < filenames.length; i++) {
    const filename = filenames[i]
    if (filename) {
      const filePath = path.join(__dirname, `../download/${uk}/` + filename)
      console.log(filePath)
      const exist = isExist(filePath)
      // 文件存在， 删除
      if (exist) fs.rmSync(filePath)
    }
  }
  return true
}

/**
 * 写入下载中断文件
 * @param data 文件信息
 */
const writeLogFile = data => {
  const filePath = path.join(__dirname, './unDoneList.json')
  // 是否存在json文件
  const exist = isExist(filePath)
  let jsonData
  if (exist) { // 存在则引入
    jsonData = require('./unDoneList.json')
    Object.values(data).forEach(v => {
      jsonData[v.fsid] = v
    })
  } else {
    jsonData = data
  }
  
  fs.writeFile(filePath, JSON.stringify(jsonData), 'utf8', err => {
    if (err) console.log(err)
  })
}

// 下载完成删掉
const deleteLogFile = fsid => {
  const filePath = path.join(__dirname, './unDoneList.json')
  const exist = isExist(filePath)
  let jsonData
  if (exist) {
    jsonData = require('./unDoneList.json')
    delete jsonData[fsid]
  }
  
  fs.writeFile(filePath, JSON.stringify(jsonData), 'utf8', err => {
    if (err) console.log(err)
  })
}

// 删除下载任务
const deleteDownload = (uk, files) => {
  return new Promise(resolve => {
    const filePath = path.join(__dirname, './unDoneList.json')
    const exist = isExist(filePath)
    let jsonData
    if (exist) {
      jsonData = require('./unDoneList.json')
      const deleteFileArr = []
      files.forEach(fileInfo => {
        const fileInfoObj = JSON.parse(fileInfo)
        delete jsonData[fileInfoObj.fsid]
        const {filename} = filenameHandle(fileInfoObj.filename, fileInfoObj.fsid, 'input')
        console.log(fileInfoObj.fsid, filename)
        deleteFileArr.push(filename)
      })
      deleteFiles(uk, deleteFileArr)
    }
    
    fs.writeFile(filePath, JSON.stringify(jsonData), 'utf8', err => {
      if (err) {
        console.log(err)
        resolve(false)
      }
      resolve(true)
    })
  })
}

module.exports = {
  writeFile,
  isExist,
  listLocalFiles,
  openExplorer,
  deleteFiles,
  writeLogFile,
  getFileRange,
  deleteLogFile,
  deleteDownload
}
