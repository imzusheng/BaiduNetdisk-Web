<template>
  <div id="playerContainer">

    <!--  文件名 s  -->
    <div class="player-title">
      <b>{{ filename }}</b>
    </div>

    <!--  播放器 s -->
    <div class="player-video">
      <!--   加载 s   -->
      <div class="player-loading" v-if="!videoCanplay">
        <img src="../assets/img/Astronaut.png" alt="loading.png">
        <span>&nbsp;&nbsp;&nbsp;{{ loadingText }}...</span>
      </div>
      <!--  video s -->
      <div id="videoPlayer"/>
    </div>
  </div>
</template>

<script setup>
import Hls from 'hls.js'
import DPlayer from 'dplayer'
import {useRouter} from "vue-router"
import {useStore} from "vuex"
import {ref} from "vue"

const router = useRouter()
const store = useStore()
// 视频是否可播放
const videoCanplay = ref(false)
// 加载提示文字
const loadingText = ref('正在加载广告')

const videoPath = decodeURIComponent(router.currentRoute.value.query?.videoPath.toString())
const filename = router.currentRoute.value.query?.videoName
const poster = decodeURIComponent(router.currentRoute.value.query?.videoPoster.toString())

if (router.currentRoute.value.query?.videoPath) {
  store.dispatch('getStream', videoPath).then(adToken => {
    let time = 5
    const timer = setInterval(() => {
      loadingText.value = `正在跳过广告 剩余${time}s`
      if (time === 0) {
        getVideo(adToken)
        clearInterval(timer)
      }
      time--
    }, 1000)
  })
}

function getVideo(adToken) {
  loadingText.value = '正在获取m3u8, 就快好了'
  store.dispatch('getStreamUrl', {path: videoPath, adToken}).then(m3u8Url => {
    loadingText.value = '正在加载视频, 就快好了'
    const dp = new DPlayer({
      container: document.getElementById('videoPlayer'),
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
            // video.play()
          },
        },
      },
    })
    dp.on('canplay', () => {
      videoCanplay.value = true
    })
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

  if (url.indexOf('http://localhost:3101') === -1) {
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

  .player-title {
    padding-bottom: 12px;
  }

  .player-video {
    width: 100%;
    height: 100%;
    max-width: 968px;
    position: relative;

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
    }
  }
}
</style>
