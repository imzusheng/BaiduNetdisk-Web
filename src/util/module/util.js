// string 转 blob

export const stringToBlob = (str, MIME) => {
  return new Blob([str], {
    type: MIME
  })
}

// blob 转 file
export const blobToFile = (blob, filename, opt) => {
  const options = opt || {}
  return new File([blob], filename, options)
}

// file 转 url
export const fileToUrl = file => {
  return new Promise(resolve => {
    const reader = new FileReader()
    // onload是指readAsDataURL处理完后
    reader.onload = evt => resolve(evt.target.result)
    reader.readAsDataURL(file)
  })
}

// ArrayBuffer转base64
export const arrayBufferToBase64 = buffer => {
  let binaryStr = ""
  const bytes = new Uint8Array(buffer)
  let length = bytes.byteLength
  for (let i = 0; i < length; i++) {
    binaryStr += String.fromCharCode(bytes [i]);
  }
  const res = window.btoa(binaryStr)
  return {
    str: res,
    url: 'data:image/jpeg;base64,' + res
  }
}

// ArrayBuffer合并
export const mergeArrayBuffer = (...arrays) => {
  let totalLen = 0
  for (let i = 0; i < arrays.length; i++) {
    arrays[i] = new Uint8Array(arrays[i]) //全部转成Uint8Array
    totalLen += arrays[i].length
  }
  
  let res = new Uint8Array(totalLen)
  
  let offset = 0
  for (let arr of arrays) {
    res.set(arr, offset)
    offset += arr.length
  }
  
  return res.buffer
}

// 格式化时间
export const formatDate = date => {
  const convert = num => num < 10 ? `0${num}` : num
  const dateObj = new Date(date)
  const month = convert(dateObj.getMonth() + 1)
  const day = convert(dateObj.getDate())
  const hours = convert(dateObj.getHours())
  const minutes = convert(dateObj.getMinutes())
  return `${dateObj.getFullYear()}-${month}-${day}  ${hours}:${minutes}`
}

// 格式化文件大小 传入单位B
export const formatFileSize = size => {
  // size不存在时返回标记
  if (!size) return '-'
  // 单位
  const unit = ['B', 'KB', 'MB', 'GB']
  // 执行convertSize的次数
  let i = 0
  
  // 转换单位，根据循环次数对应unit的下标，匹配对应单位
  function convertSize(newSize) {
    i++
    // 小于1024 无法在运算则返回
    if (newSize / 1024 < 1024) {
      return {
        i,  // 执行次数， 用来匹配单位
        num: newSize / 1024 // 当前大小
      }
    } else {
      return convertSize(newSize / 1024)
    }
  }
  
  // 获取结果
  const res = convertSize(size)
  // 返回大小加上单位
  return res.num.toFixed(2) + ' ' + unit[res.i]
}

// 截取文件后缀名
export const getFileExt = filename => {
  if (!filename) return ''
  return filename.substring(filename.lastIndexOf('.'))
}

// 获取文件图标
export const getFileIcon = filename => {
  const ext = getFileExt(filename)
  if (['.png', '.jpg', '.jpeg', '.svg'].includes(ext)) {
    return '相片.svg'
  } else if (['.zip', '.rar', '.7z'].includes(ext)) {
    return '压缩包.svg'
  } else if (['.mov', '.mp4', '.avi'].includes(ext)) {
    return '视频.svg'
  } else if (['.psd'].includes(ext)) {
    return 'psd.svg'
  } else if (['.word'].includes(ext)) {
    return 'word.svg'
  } else if (['.excel'].includes(ext)) {
    return 'excel.svg'
  } else if (['.pdf'].includes(ext)) {
    return 'pdf.svg'
  } else {
    return '未知文件.svg'
  }
}

// 传入url，返回所有参数（get）
export const urlFilter = url => {
  const separatorIndex = url.indexOf('?')
  const prefix = url.substring(0, separatorIndex)
  const delPrefix = url.substring(separatorIndex + 1)
  const urlStrSplit = delPrefix.split('&')
  // 导出数组形式
  const resArr = urlStrSplit.map(v => {
    const obj = {}
    const args = v.split('=')
    obj[args[0]] = args[1]
    return obj
  })
  // 导出对象形式
  const obj = {}
  urlStrSplit.forEach(v => {
    const args = v.split('=')
    obj[args[0]] = args[1]
  })
  return {
    rawUrl: prefix,
    obj,
    arr: resArr
  }
}

// 内容裁剪 替换汉字为两个字符串
export const textClip = (context, num = 10) => {
  if (!context) return ''
  return context.replace(/[\u0391-\uFFE5]/g, 'aa').length > num ? context.slice(0, num) + '...' : context
}

// 创建Promise队列
export class PromiseQueue {
  /**
   * 传入参数
   * @param taskList
   * @param time 请求间隔时间
   */
  constructor(taskList, time) {
    this.result = {}
    this.time = time
    this.promiseList = taskList.map(task => this.createPromise(task.cb, task.index))
  }
  
  // 开始执行队列，获取结果
  /**
   * @return {Promise<Object>}
   */
  getResult = () => {
    // 开始执行任务
    this.promiseEnd = this.promiseList.reduce((prev, next) => {
      return prev.then(() => next())
    }, Promise.resolve())
    // 执行完成获取结果
    return new Promise(resolve => {
      this.promiseEnd.then(() => resolve(this.result))
    })
  }
  // 创建任务
  createPromise = (cb, index) => {
    return () => {
      return new Promise(resolve => {
        setTimeout(() => {
          cb()
              .then(res => {
                this.result[index] = res
                resolve()
              })
              .catch(res => {
                this.result[index] = res
                resolve()
              })
        }, this.time)
      })
    }
  }
}
