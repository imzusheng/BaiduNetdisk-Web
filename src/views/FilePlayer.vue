<template>
  <div id="playerContainer">
    <!--  播放器 s -->
    <div class="player-video">

      <!--  video s -->
      <div class="player-video-container">
        <!--  全屏按钮  -->
        <div class="player-video-fullScreen" @click="playerListShow = !playerListShow" v-if="listSwitchBtn">
          <arrow-right-bold v-if="playerListShow"/>
          <arrow-left-bold v-else/>
        </div>
        <!--   加载 s   -->
        <div class="player-loading" v-if="!videoCanplay">
          <img src="../assets/img/Astronaut.png" alt="loading.png">
          <span>&nbsp;&nbsp;&nbsp;{{ loadingText }}...</span>
        </div>
        <div id="videoPlayer"/>
      </div>

      <!--  播放列表 s -->
      <div class="player-list" v-if="playerListShow">
        <div class="player-title"><h2>{{ $router.currentRoute.value.query?.videoName }}</h2></div>
        <div class="player-list-main">
          <ul>
            <li v-for="(item , index) in playerList" :key="index" @click="switchVideo(item)">
              <img :src="item.thumbs.url1" alt="videoPoster">
              <div class="list-video-info">
                <div class="video-info-name">{{ item.server_filename }}</div>
              </div>
            </li>
          </ul>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import Hls from 'hls.js'
import DPlayer from 'dplayer'
import {useRouter} from "vue-router"
import {useStore} from "vuex"
import {ref, computed} from "vue"
import {ArrowRightBold, ArrowLeftBold} from '@element-plus/icons-vue'

const router = useRouter()
const store = useStore()

// 播放列表
const playerList = computed(() => store.state.fileList)
// 播放列表是否显示
const playerListShow = ref(true)
// 播放列表显示/隐藏切换按钮是否显示
const listSwitchBtn = ref(true)
// 视频是否可播放
const videoCanplay = ref(false)
// 加载提示文字
const loadingText = ref('正在加载')
// 播放器实例
let dp = null

// 如果存在媒体路径
if (router.currentRoute.value.query?.videoPath) {
  const filename = router.currentRoute.value.query?.videoName
  const videoPath = decodeURIComponent(router.currentRoute.value.query?.videoPath.toString())
  const poster = decodeURIComponent(router.currentRoute.value.query?.videoPoster.toString())
  getVideoList({videoPath, filename})
  getAdToken({videoPath, poster})
}

const switchVideo = (video) => {
  getAdToken({
    videoPath: video.path,
    poster: video.thumbs.url3
  })
}

// 获取adToken
function getAdToken(args) {
  videoCanplay.value = false
  store.dispatch('getStream', args.videoPath).then(adToken => {
    // 如果存在广告时间， 倒计时跳过广告
    // let time = 1
    // const timer = setInterval(() => {
    //   loadingText.value = `正在跳过广告 剩余${time}s`
    //   if (time === 0) {
    //     getVideo(adToken)
    //     clearInterval(timer)
    //   }
    //   time--
    // }, 1000)
    if (!adToken) getVideo(' ', args) // VIP直接没有广告，手动赋值为空格字符串
    else getVideo(adToken, args)
  })
}

// 获取m3u8， 初始化播放器
function getVideo(adToken, {videoPath, poster}) {
  loadingText.value = '正在获取m3u8, 就快好了'
  store.dispatch('getStreamUrl', {path: videoPath, adToken}).then(m3u8Url => {
    loadingText.value = '正在加载视频, 就快好了'
    if (dp) {
      dp.destroy()
      dp = null
    }
    initDPlayer(m3u8Url, poster)
  })
}

// 初始化播放器
function initDPlayer(m3u8Url, poster) {
  // 初始化播放器
  dp = new DPlayer({
    container: document.getElementById('videoPlayer'),
    playbackSpeed: [0.5, 0.75, 1, 1.25, 1.5, 2, 3],
    video: {
      pic: poster,
      // url: 'http://localhost:3101/public/ts.m3u8',
      // url: 'http://1257120875.vod2.myqcloud.com/0ef121cdvodtransgzp1257120875/3055695e5285890780828799271/v.f230.m3u8',
      url: m3u8Url,
      type: 'customHls',
      customType: {
        customHls: function (video) {
          const hls = new Hls()
          hls.on(Hls.Events.ERROR, function (event, data) {
            const errorType = data.type;
            const errorDetails = data.details;
            const errorFatal = data.fatal;
            console.log(errorType, errorDetails, errorFatal)
          });
          hls.loadSource(video.src)
          hls.attachMedia(video)
        },
      },
    },
  })
  dp.on('canplay', () => {
    videoCanplay.value = true
  })
  dp.on('fullscreen', () => {
    playerListShow.value = false
  })
  dp.on('fullscreen_cancel', () => {
    playerListShow.value = true
  })
}

// 获取该目录的视频列表， 用来显示播放列表
function getVideoList({videoPath, filename}) {
  store.dispatch('getFileCategory', {
    category: 'videolist',
    path: videoPath.replace('/' + filename, ''),
    order: 'name'
  })
}

// const property = Object.getOwnPropertyDescriptor(Image.prototype, 'src')
// const nativeSet = property.set
//
// Object.defineProperty(Image.prototype, 'src', {
//   set: function (url) {
//     nativeSet.call(this, url);
//   }
// })
// const videoNativeSet = Object.getOwnPropertyDescriptor(HTMLSourceElement.prototype, 'src').set
//
// Object.defineProperty(HTMLSourceElement.prototype, 'src', {
//   set: function (url) {
//     console.log('video', url)
//     videoNativeSet.call(this, url);
//   }
// })

// 拦截原生xhr请求，这里作用是拦截video中source发出的拉取视频流请求
XMLHttpRequest.prototype.nativeOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function (method, url, async) {

  let handledUrl = url

  if (url.indexOf('my-streaming') > -1) {
    const tempUrl = encodeURIComponent(url + '')
    const tempHeaders = JSON.stringify({ // 百度网盘视频分片拉取
      "User-Agent": "nvideo;bNestDisk;1.0.0;Windows;10;ts",
      "Type": "M3U8_AUTO_480"
    })
    handledUrl = `http://localhost:3101/api/rawProxy?mergeHeaders=0&url=${tempUrl}&headers=${tempHeaders}`
  }

  this.nativeOpen(method, handledUrl, async);
}
</script>

<style lang="less" scoped>
#playerContainer {
  width: 100%;
  min-width: 768px;
  height: calc(100vh - 60px);
  padding: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  background: rgba(14, 14, 14, 1);

  .player-video {
    width: 100%;
    height: 100%;
    display: flex;

    // video
    .player-video-container {
      width: 100%;
      position: relative;

      // 全切换按钮
      .player-video-fullScreen {
        height: 80px;
        width: 30px;
        position: absolute;
        background: rgba(40, 40, 40, 1);
        z-index: 4;
        top: 50%;
        right: 0;
        margin-top: -40px;
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        border-radius: 6px 0 0 6px;

        > svg {
          height: 80%;
          width: 80%;
          color: rgba(100, 100, 100, 1);
        }
      }

      // 视频加载提示
      .player-loading {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;

        > span {
          color: #409eff;
        }

        > img {
          height: 300px;
          margin-bottom: 20px;
        }
      }

      #videoPlayer {
        height: 100%;
        border-radius: 12px;
        overflow: hidden;
      }
    }

    // 播放列表
    .player-list {
      width: 360px;
      display: flex;
      padding: 16px 0 16px 16px;
      max-width: 360px;
      margin-left: 16px;
      flex-direction: column;
      background: rgba(30, 30, 30, 1);
      border-radius: 12px;
      box-sizing: border-box;

      .player-title {
        padding-right: 20px;
        margin-bottom: 36px;
        font-size: 15px;
        color: rgba(240, 240, 240, 1);

        > h2 {
          display: -webkit-box;
          overflow: hidden;
          text-overflow: ellipsis;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      }

      .player-list-main {
        overflow-y: auto;

        &::-webkit-scrollbar-thumb, &::-webkit-scrollbar-thumb:hover {
          width: 8px;
          border-radius: 4px;
          background-image: -webkit-linear-gradient(left, hsla(0, 0%, 100%, .2), hsla(0, 0%, 100%, .2));
        }

        &::-webkit-scrollbar, &::-webkit-scrollbar {
          width: 8px;
          border-radius: 4px;
        }

        > ul {
          > li {
            cursor: pointer;
            display: flex;
            margin-bottom: 16px;
            opacity: .7;

            &:hover {
              opacity: 1;
            }

            > img {
              height: 60px;
              width: 40%;
              object-fit: cover;
            }

            .list-video-info {
              flex: 1;
              margin-left: 12px;

              .video-info-name {
                font-size: 14px;
                color: rgba(180, 180, 180, 1);
              }
            }
          }
        }
      }
    }
  }
}
</style>
