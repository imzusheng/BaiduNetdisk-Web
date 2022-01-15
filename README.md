### 这是
* 百度网盘开放API + Vue3 + Element Plus + express搭建的百度网盘web页面(没广告)
* 本地nodejs服务器做代理，不需要服务器和数据库
* 实时下载进度条，可以开始/暂停。支持断点续传，不限制多任务。
* 贴心引导页，第一次用百度OAuth还是折腾了一会；用Authorization Code方式登录，会玩的可以在server/auth.json改其他的授权方式
* 后期尝试electron打包成桌面应用
* 众生平等(该限速仍然限速)

### 使用
```bash
cd baidu_netdisk && npm i
npm run serve

cd baidu_netdisk/server && npm i
nodemon index 或 node index
```

占了两个端口: 3101(http), 3102(websocket)

### 页面

1. 登录引导(使用Authorization Code方式)
![主页](https://demo.zusheng.club/README/bd_login.png)

2. 文件列表
![主页](https://demo.zusheng.club/README/bd_home.png)

3. 下载列表-下载中
![主页](https://demo.zusheng.club/README/bd_download_1.png)

4. 下载列表-暂停
![主页](https://demo.zusheng.club/README/bd_download_2.png)

5. 本地下载文件夹
![主页](https://demo.zusheng.club/README/bd_local.png)
