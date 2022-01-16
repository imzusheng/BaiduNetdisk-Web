import config from "@/util/module/config"
import * as util from "@/util/module/util"
import AxiosTools from "@/util/module/axiosTools"
import Api from '@/util/module/api'

let axiosTools, api, store

export function init(storeArgs) {
  store = storeArgs
  axiosTools = new AxiosTools(store)
  api = new Api(store)
}

export {
  api,
  util,
  store,
  config,
  axiosTools
}
