import {createStore} from 'vuex'
import {api, config, init} from "@/util";
import {ElMessage} from "element-plus"
import WsServer from 'quick-ws-server'
import router from "@/router";

export const store = createStore({
  state: {
    ws: new WsServer({
      url: 'ws://localhost:3102',
      reConnectGap: 3000
    }),
    // 登陆面板是否显示
    dialogVisible: false,
    // token等信息
    auth: {},
    authJsonPath: '', // 配置文件路径
    // 主页文件列表
    fileList: [],
    // 剩余容量配额信息
    quotaInfo: {
      total: '',
      used: '',
      rate: 0
    },
    // 主页文件列表加载中
    fileListLoading: false,
    // 主页文件列表面包屑
    fileListBreadcrumb: ['全部文件'],
    // 面包屑宽度超标
    breadcrumbExceed: false,
    // 下载进度信息
    download: {},
    // 用户信息
    userInfo: {},
    // 已下载的页面数据
    listLocalFiles: [],
    // 搁置的请求
    shelveRequest: []
  },
  mutations: {
    // 授权信息
    setAuth(state, payLoad) {
      state.auth = payLoad.result
      state.authJsonPath = payLoad.filePath
      Object.assign(config, payLoad.result)
      // Object.freeze(config)
    },
    // access_token
    setAccessToken(state, payLoad) {
      state.accessToken = payLoad
    },
    // 用户信息
    setUserInfo(state, payLoad) {
      state.userInfo = payLoad
    },
    // 下载列表(未完成)
    setUndoneList(state, payload) {
      state.download = payload
    },
    // 更改文件的下载/暂停状态
    setDownloadStatus(state, payload) {
      if (payload.status === 'pauseAll') {
        Object.keys(state.download).forEach(fsid => {
          state.download[fsid].status = 'pause'
        })
      } else {
        state.download[payload.fsid].status = payload.status
      }
    },
    // 更新面包屑是否超出宽度
    setBreadcrumb() {
      // let homeTools = window.document.querySelector('.home-main-tools')
      // let homeBreadcrumb = window.document.querySelector('#homeBreadcrumb')
      // state.breadcrumbExceed = (homeTools && homeBreadcrumb && homeBreadcrumb.clientWidth / homeTools.clientWidth > 1) || false
    },
    // 更改已下载的页面数据
    setLocalFiles(state, payload) {
      state.listLocalFiles = payload
    },
    // 剩余容量等配额
    setQuotaInfo(state, payload) {
      const {total, used} = payload
      state.quotaInfo.total = (total / 1024 / 1024 / 1024).toFixed(0) + 'G'
      state.quotaInfo.used = (used / 1024 / 1024 / 1024).toFixed(0) + 'G'
      state.quotaInfo.rate = (used / total).toFixed(2) * 100
    },
    // 文件列表
    setFilesList(state, payload) {
      state.fileList.length = 0
      Object.assign(state.fileList, payload.list)
      state.fileListLoading = false
    }
  },
  actions: {
    // 处理因为未获取access_token而搁置的请求
    shelveGet({state}) {
      state.shelveRequest.forEach(request => request())
    },
    // 获取token
    getAuth({commit}) {
      return new Promise(resolve => {
        api.getAuth().then(res => {
          commit('setAuth', res)
          resolve()
        })
      })
    },
    // 获取accessToken
    postAccessToken({commit}, payload) {
      return new Promise(resolve => {
        api.postAccessToken(payload).then(res => {
          commit('setAccessToken', res)
          resolve(res)
        })
      })
    },
    // 获取用户信息
    getUserInfo({commit}) {
      return new Promise(resolve => {
        api.getUserInfo().then(res => {
          commit('setUserInfo', res)
          resolve()
        })
      })
    },
    // 获取未下载完成的任务列表
    getUndoneList({commit}) {
      api.getUndoneList().then(res => commit('setUndoneList', res))
    },
    // 获取本地已下载的文件信息
    getLocalFiles({commit}) {
      api.listLocalFiles().then(res => commit('setLocalFiles', res))
    },
    // 获取配额，容量信息
    getQuotaInfo({commit}) {
      api.getQuota().then(res => commit('setQuotaInfo', res))
    },
    // 删除下载文件夹中的文件
    deleteFiles(context, filePathList) {
      return new Promise(resolve => {
        api.deleteFiles(filePathList).then(res => {
          ElMessage({
            type: res ? 'success' : 'error',
            message: res ? '删除成功' : '删除失败'
          })
          resolve()
        })
      })
    },
    // 删除下载中的任务
    deleteDownload(context, filePathList) {
      return new Promise(resolve => {
        api.deleteDownload(filePathList).then(res => {
          ElMessage({
            type: res ? 'success' : 'error',
            message: res ? '删除成功' : '删除失败'
          })
          resolve()
        })
      })
    },
    // 获取文件列表
    getFilesList({state, commit}, payload) {
      const path = payload || state.fileListBreadcrumb.join('/').replaceAll('全部文件', '')
      const fn = () => {
        api.getFileList(path).then(res => commit('setFilesList', res))
      }
      if (!store.state.auth['access_token']) {
        state.shelveRequest.push(fn)
      } else {
        fn()
      }
    },
    // 退出登录
    logout() {
      return api.logout()
    },
    // 搜索文件
    getSearch({commit, state}, payload) {
      state.fileListLoading = true
      router.push({
        query: {
          path: router.currentRoute.value.query?.path || null,
          type: 'search'
        }
      })
      api.getSearch(payload).then(res => {
        commit('setFilesList', res)
      })
    },
    // 文件管理
    postFileManager(context, payload) {
      return api.postFileManager(payload)
    },
    // 递归文件夹信息
    getMultiFileList(context, payload) {
      return api.getMultiFileList(payload)
    },
    // 获取文件信息，dlink等
    getFileMeta(context, payload) {
      return api.getFileMeta(payload)
    },
    // 记录下载任务到json
    postRecordTasks(context, payload) {
      return api.postRecordTasks(payload)
    },
    // 获取文件-分类图片
    getFileCategory({commit, state}, payload) {
      const fn = () => {
        api.getFileCategory(payload).then(res => {
          commit('setFilesList', {list: res.info})
        })
      }
      if (!store.state.auth['access_token']) {
        state.shelveRequest.push(fn)
      } else {
        fn()
      }
    },
    // 获取视频流
    getStream(context, path) {
      return new Promise(resolve => {
        api.getStream(path).then(({adToken}) => {
          setTimeout(() => api.getStream(path, adToken).then(resM3u8 => resolve(resM3u8)), 6 * 1000)
        })
      })
    }
  },
  modules: {}
})

init(store)
