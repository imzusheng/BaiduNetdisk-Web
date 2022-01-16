import axios from 'axios'

export default class axiosTools {
  constructor(store) {
    this.baseURL = 'http://localhost:3101'
    this.proxyURL = 'http://localhost:3101/api'
    
    axios.defaults.baseURL = this.baseURL + '/api'
    axios.defaults.headers['X-Requested-With'] = 'XMLHttpRequest'
    axios.defaults.headers.post['Content-Type'] = 'application/json'
    
    const CancelToken = axios.CancelToken
    const source = CancelToken.source()

    // 请求拦截
    axios.interceptors.request.use(config => {
      // config.headers.Authorization = localStorage.getItem('token')
      config.headers.UserUk = JSON.stringify(store.state.userInfo?.uk)
      // 没有access_token,也没有cross标记(我自己加的),就拦截
      if (!store.state.auth['access_token'] && !config?.params?.cross && !config?.data?.cross) {
        config.cancelToken = source.token
        source.cancel('access_token缺失,请登录')
      }
      return config
    })

    // 响应拦截器
    axios.interceptors.response.use(async response => {
      // ...
      return response?.data ?? response
    }, error => {
      // return Promise.resolve(error) // 不想看见错误可以这么做
      return Promise.reject(error)
    })
  }
  
  /**
   * @param {string} url 请求url
   * @param {Object} params 参数
   * @param {Object} opt 配置请求头等
   * @param cb 回调函数，返回传输进度
   */
  get(url = '', params = {}, opt = {}, cb) {
    const baseOpt = {
      method: 'get',
      params,
      url,
      onDownloadProgress: progress => {
        console.log('下载进度', (progress.loaded / progress.total * 100).toFixed(2))
        return cb ? cb(progress) : null
      }
    }
    return axios(Object.assign(baseOpt, opt))
  }
  
  post(url, params, opt = {}) {
    const baseOpt = {
      url,
      method: 'post',
      data: params
    }
    return axios(Object.assign(baseOpt, opt))
  }
  
  put(url, params, opt) {
    const baseOpt = {
      method: 'put',
      url,
      data: params
    }
    return axios(Object.assign(baseOpt, opt))
  }
  
  delete(url, params, opt) {
    const baseOpt = {
      method: 'delete',
      url,
      data: params
    }
    return axios(Object.assign(baseOpt, opt))
  }
  
  // 上传, cb返回上传进度
  upload(url, params, cb) {
    return axios({
      method: 'post',
      data: params,
      url,
      headers: {'Content-type': 'multipart/form-data;'},
      onUploadProgress: progress => cb ? cb(progress) : null
    })
  }
  
  /**
   * 跨域 服务器代理请求
   * @param {string} url 请求类型
   * @param {{params: {url: string}}} [opt] 代理的参数
   * @param {Object} opt.params 代理的参数
   * @param {Object} opt.headers 代理的请求头
   * @param [cb] 回调函数
   */
  proxy(url, opt, cb) {
    const baseOpt = {
      baseURL: this.proxyURL,
      url
    }
    // 回调函数返回下载进度
    if (cb) {
      baseOpt.onDownloadProgress = progress => {
        console.log((progress.loaded / progress.total * 100).toFixed(4) + '%')
        return cb({
          rawData: progress,
          msg: (progress.loaded / progress.total * 100).toFixed(0)
        })
      }
    }
    const axiosOpt = Object.assign(baseOpt, opt)
    return axios(axiosOpt)
  }
}
