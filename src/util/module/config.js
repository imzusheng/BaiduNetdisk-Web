/**
 * 从服务器获取配置文件合并到这里，所以修改这里的值没用
 */

export default {
  AppKey: '',
  SecretKey: '',
  redirect_uri: '',
  refresh_token: '',
  access_token: '',
  fileCategory: ['', '视频', '音频', '图片', '文档', '应用', '其他', '种子'],
  // 是否在electron环境中
  is_electron: process.env.IS_ELECTRON
}
