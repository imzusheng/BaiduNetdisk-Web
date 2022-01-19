// doc https://pan.baidu.com/union/doc

import {axiosTools, config} from "@/util"
import {ElMessage} from "element-plus"
import {computed} from "vue"
import {util} from "@/util";

let store, state, ws, accessToken

export default class API {
  
  constructor(storeArgs) {
    if (storeArgs) {
      store = storeArgs
      state = store.state
      ws = state.ws
      accessToken = computed(() => store.state.auth.access_token)
      this.listenWs()
    }
  }
  
  // 监听websocket收到的消息
  listenWs() {
    // ws消息监听
    ws.on('message', res => {
      const dataToJson = JSON.parse(res.data)
      
      if (dataToJson.type === 'end') { // 确认收到结束标记
        delete state.download[dataToJson.fsid]  // 下载列表删除该任务
        ElMessage({
          type: "success",
          message: `${dataToJson.filename} 下载成功`
        })
        store.dispatch('getLocalFiles')
      } else if (dataToJson.type === 'pause') { // 暂停标记
        ElMessage({
          type: "warning",
          message: `暂未开放暂停功能`
        })
        // store.commit('setDownloadStatus', {
        //   fsid: dataToJson.fsid,
        //   status: 'pause'
        // })
      } else if (dataToJson.type === 'chunk') { // 下载中
        state.download[dataToJson.fsid] = dataToJson
      } else {
        console.log(dataToJson)
      }
    })
  }
  
  // 获取appKey等信息
  getAuth = () => {
    return new Promise(resolve => {
      axiosTools.proxy('/auth', {
        params: {
          t: Date.now(),
          cross: true
        }
      }).then(res => resolve(res))
    })
  }
  
  // 获取access_token
  postAccessToken = params => {
    return new Promise(resolve => {
      axiosTools.post(
          '/accessToken',
          Object.assign(params, {cross: true})
      ).then(res => resolve(res))
    })
  }
  
  // 获取用户信息
  getUserInfo = () => {
    return new Promise(resolve => {
      const url = `https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo&access_token=${accessToken.value}`
      // 浏览器环境阻止跨域，转到代理
      if (!config.is_electron) {
        axiosTools.proxy('/proxy', {
          params: {url}
        }).then(res => resolve(res))
      } else {
        // electron环境时允许跨域，不需要代理
        axiosTools.get(url).then(res => resolve(res))
      }
    })
  }
  
  // 获取网盘文件列表
  getFileList = (path) => {
    return new Promise(resolve => {
      const url = 'https://pan.baidu.com/rest/2.0/xpan/file'
      if (!config.is_electron) {
        axiosTools.proxy('/proxy', {
          // 当前请求的参数
          params: {
            url,
            // 代理的参数
            params: {
              order: 'name',
              method: 'list',
              web: 'web',
              folder: 0,
              start: 0,
              limit: 100,
              desc: null,
              'access_token': accessToken.value,
              dir: path || '/'
            }
          }
        }).then(res => resolve(res))
      } else {
        // electron环境时允许跨域，不需要代理
        axiosTools.get(url).then(res => resolve(res))
      }
    })
  }
  
  // 获取配额
  getQuota = () => {
    return new Promise(resolve => {
      const url = `https://pan.baidu.com/api/quota?checkfree=1&checkexpire=1&access_token=${accessToken.value}`
      if (!config.is_electron) {
        axiosTools.proxy('/proxy', {
          params: {url}
        }).then(res => resolve(res))
      } else {
        // electron环境时允许跨域，不需要代理
        axiosTools.get(url).then(res => resolve(res))
      }
    })
  }
  
  // 递归获取文件列表
  getMultiFileList = path => {
    return new Promise(resolve => {
      const url = `https://pan.baidu.com/rest/2.0/xpan/multimedia`
      if (!config.is_electron) {
        axiosTools.proxy('/proxy', {
          params: {
            url: decodeURIComponent(url),
            params: {
              path,
              web: 1,
              method: 'listall',
              recursion: 1,
              start: 0,
              limit: 1000,
              'access_token': accessToken.value
            }
          }
        }).then(res => resolve(res))
      } else {
        // electron环境时允许跨域，不需要代理
        axiosTools.get(url).then(res => resolve(res))
      }
    })
  }
  
  // 获取文件信息 dlink
  getFileMeta = (fsids = []) => {
    return new Promise(resolve => {
      const url = `https://pan.baidu.com/rest/2.0/xpan/multimedia`
      if (!config.is_electron) {
        axiosTools.proxy('/proxy', {
          // 当前请求的参数
          params: {
            url,
            // 代理的参数
            params: {
              fsids: `[${[...fsids]}]`,
              method: 'filemetas',
              thumb: 1,
              extra: 1,
              dlink: 1,
              'access_token': accessToken.value
            }
          }
        }).then(res => resolve(res))
      } else {
        // electron环境时允许跨域，不需要代理
        axiosTools.get(url).then(res => resolve(res))
      }
    })
  }
  
  // 代理下载
  getDownload = (dlink, filename, fsid) => {
    // 发送dlink到服务器开始下载
    ws.sendMsg({
      type: 'download',
      uk: state.userInfo.uk,
      filename,
      fsid,
      url: `${dlink}&access_token=${accessToken.value}`.toString(),
    })
  }
  
  // 暂停任务
  closeWebsocket = fileInfo => {
    const {fsid} = fileInfo
    ws.sendMsg({
      type: 'pause',
      fsid
    })
  }
  
  // 取消任务
  deleteDownload = list => {
    return new Promise(resolve => {
      axiosTools.proxy('/deleteDownload', {
        params: {
          list,
          cross: true
        }
      }).then(res => resolve(res))
    })
  }
  
  // 获取下载的所有文件信息
  listLocalFiles = () => {
    return new Promise(resolve => {
      axiosTools.proxy('/listLocal', {
        params: {
          cross: true
        }
      }).then(res => resolve(res))
    })
  }
  
  // 删除本地文件
  deleteFiles = filenameList => {
    return new Promise(resolve => {
      axiosTools.proxy('/deleteFiles', {
        params: {
          filenameList,
          cross: true
        }
      }).then(res => resolve(res))
    })
  }
  
  // 打开本地文件夹
  openExplorer = (filename = '') => {
    axiosTools.proxy('/openExplorer', {
      params: {
        filename,
        cross: true
      }
    }).then()
  }
  
  // 获取下载任务列表
  getUndoneList = () => {
    return new Promise(resolve => {
      axiosTools.proxy('/undoneList', {
        params: {
          t: Date.now(),
          cross: true
        }
      }).then(res => resolve(res))
    })
  }
  
  // 退出登录
  logout = () => {
    return new Promise(resolve => {
      axiosTools.proxy('/logout', {
        params: {
          t: Date.now(),
          cross: true
        }
      }).then(res => resolve(res))
    })
  }
  
  // 搜索
  getSearch = ({value: key, dir = '/'}) => {
    return new Promise(resolve => {
      axiosTools.proxy('/proxy', {
        // 当前请求的参数
        params: {
          url: 'https://pan.baidu.com/rest/2.0/xpan/file',
          // 代理的参数
          params: {
            method: 'search',
            key,
            dir,
            num: 100,
            recursion: 1,
            page: 2,
            order: 'time',
            desc: 1,
            web: 1,
            'access_token': accessToken.value
          }
        }
      }).then(res => resolve(res))
    })
  }
  
  // 管理文件
  postFileManager = ({opera, filelist}) => {
    return new Promise(resolve => {
      axiosTools.proxy('/proxy', {
        params: {
          url: encodeURI(`https://pan.baidu.com/rest/2.0/xpan/file?method=filemanager&opera=${opera}&access_token=${accessToken.value}`),
          method: 'post',
          params: {
            filelist,
            async: 0
          }
        }
      }).then(res => resolve(res))
      // filelist 参考
      // console.log({
      //   copy: [{
      //     path: "/测试目录/123456.docx",
      //     dest: "/测试目录/abc",
      //     newname: "11223.docx",
      //     ondup: "fail"
      //   }],
      //   move: [{
      //     path: "/测试目录/123456.docx",
      //     dest: "/测试目录/abc",
      //     newname: "11223.docx",
      //     ondup: "fail"
      //   }],
      //   rename: [{
      //     path: "/测试目录/123456.docx",
      //     newname: "test.docx"
      //   }],
      //   delete: ["/测试目录/123456.docx"]
      // })
    })
  }
  
  // 记录下载任务
  postRecordTasks = list => {
    const newList = list.map(v => {
      return {
        dlink: v.dlink,
        filename: v.filename,
        fsid: v.fs_id,
        path: v.path,
        status: 'pause',
        rawFilename: util.filenameHandle(v.filename, v.fs_id, 'input'),
        type: 'chunk',
        total: v.size,
        progress: 0,
        curFileSize: 0,
      }
    })
    return new Promise(resolve => {
      axiosTools.post('/recordTasks', {
        list: newList
      }).then((res) => resolve(res))
    })
  }
  
  // ws触发下载任务
  wsStartDownload = (opt) => {
    ws.sendMsg(Object.assign({
      type: 'startDownload',
      uk: JSON.stringify(store.state.userInfo?.uk),
      accessToken: accessToken.value,
      sum: 3
    }, opt))
  }
}
