import config from "@/util/module/config"
import * as util from "@/util/module/util"
import AxiosTools from "@/util/module/axiosTools"
import Api from '@/util/module/api'

let axiosTools = new AxiosTools(null),
    api = new Api(null),
    store

export function init(storeArgs) {
  store = storeArgs
  axiosTools = new AxiosTools(store)
  api = new Api(store)
}

// es module导出的时引用,因此init前store为undefined,执行后为store
export {
  api,
  util,
  store,
  config,
  axiosTools
}
