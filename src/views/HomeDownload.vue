<template>
  <div id="download">

    <!--  删除任务栏 s  -->
    <div class="download-tools">
      <!--  多选按钮管理  -->
      <div style="display: flex; align-items: center">
        <el-button-group>
          <el-button
              :disabled="data.length === 0"
              type="primary"
              :icon="Download"
              @click="startDownload"
              round>
            <b>全部开始</b>
          </el-button>
          <el-button
              :disabled="data.length === 0"
              type="primary"
              :icon="VideoPause"
              @click="pauseDownload()"
              plain
              round>
            <b>全部暂停</b>
          </el-button>
        </el-button-group>
        <el-button-group>
          <el-button
              @click="cancelDownload(null)"
              :disabled="data.length === 0"
              style="margin-left: 12px"
              type="warning"
              :icon="Close"
              plain
              round>
            <b>删除所有任务</b>
          </el-button>
        </el-button-group>
      </div>

      <!-- 提示文本 s -->
      <div
          style="font-size: 14px; color: rgb(96, 98, 102); display: flex; align-items: center">
        <info-filled
            style="width: 16px; height: 16px; cursor: pointer; color: rgba(255,186,21,1); margin-right: 6px;"/>
        单击可开始/暂停下载
      </div>

    </div>

    <ul class="download-list" v-if="data.length > 0">

      <!-- 下载任务项 s -->
      <li
          class="download-list-item"
          v-for="(item, key) in data"
          :key="key">
        <div class="download-item-content" @click="itemClick(item)">
          <!--  模拟进度条  s    -->
          <span
              v-if="item?.status !== 'pause'"
              class="list-item-progress"
              :style="{clipPath: `inset(0 ${100 - item.progress}% 0 0)`}"
          ></span>
          <span
              v-else
              class="list-item-progress pause"
              :style="{clipPath: `inset(0 ${100 - item.progress}% 0 0)`}"
          ></span>
          <div class="list-item-info">
            <span class="info-name">{{ item.filename }}</span>
            <span class="info-connect" v-if="item?.status === 'pending'">
                  {{ item.connect }}
                </span>
            <span class="info-progress" v-else>
                  {{ util.formatFileSize(item.curFileSize) }}/{{ util.formatFileSize(item.total) }}
                </span>
          </div>
        </div>

        <div class="download-item-tools" @click="cancelDownload(item)">
          <delete-filled style="height: 24px; width: 24px; color: red"/>
        </div>
      </li>

    </ul>

    <p style="display: flex; justify-content: center; align-items: center; color: #999; padding: 40px" v-else>暂无下载任务</p>

  </div>
</template>

<script setup>
import {useStore} from "vuex";
import {computed, toRaw} from "vue"
import {util, api} from '@/util'
import {InfoFilled, Close, DeleteFilled, Download, VideoPause} from "@element-plus/icons-vue"

const store = useStore()

// 未完成的任务列表数据
const data = computed(() => Object.values(store.state.download))

// 点击其中一个任务
const itemClick = itemData => {
  const rawData = toRaw(itemData)
  if (store.state.download[rawData.fsid].status === 'pending') return // 在点击第一次后设置状态为pending，防止重复点击
  if (rawData?.status === 'pause') {  // 当前状态是暂停，则重新连接
    store.state.download[rawData.fsid].connect = '正在重新连接...'
    store.dispatch('getFileMeta', [rawData.fsid]).then(res => {
      store.state.download[rawData.fsid].connect = '正在获取资源...'
      const fileMeta = res.list[0]
      api.startOneTask(fileMeta.dlink, rawData.fsid)
    })
  } else if (rawData?.status === 'run') {  // 当前状态是下载中，则暂停任务
    api.pauseOneTask(rawData.fsid)
  }
  store.state.download[rawData.fsid].status = 'pending' // 在点击第一次后设置状态为pending，防止在收到服务器响应前重复点击，造成错误
}

// 取消下载 TODO 取消所有任务需要换个策略,不需要发送路径,只要把json内的curFileSize不为0且不等于total的说明正在下载中
const cancelDownload = itemData => {
  if (itemData) {
    const {fsid, path} = toRaw(itemData)
    store.dispatch('deleteDownload', [{
      fsid,
      path
    }]).then(() => {
      store.dispatch('getUndoneList')
      store.dispatch('getLocalFiles')
    })
  } else { // 删除全部任务
    const filePathList = data.value.map(v => {
      return {
        path: v.path,
        fsid: v.fsid
      }
    })
    store.dispatch('deleteDownload', filePathList).then(() => {
      store.dispatch('getUndoneList')
      store.dispatch('getLocalFiles')
    })
  }
}

// 开始全部任务
const startDownload = () => {
  api.wsStartDownload({
    sum: 3 // 最大并行任务数量
  })
}

// 暂停全部任务
const pauseDownload = () => {
  api.wsPauseDownload()
}

</script>

<style lang="less">
#download {
  width: 100%;
  height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;

  .download-tools {
    display: flex;
    align-items: center;
    padding: 20px 32px 12px 20px;
    justify-content: space-between;
  }

  .download-list {
    width: 100%;
    height: 100%;
    min-height: 200px;
    overflow-y: auto;
    padding: 20px;

    .download-list-item {
      width: 100%;
      height: 60px;
      margin-bottom: 12px;
      position: relative;

      &:hover {
        will-change: auto;

        .download-item-content {
          clip-path: inset(0px 36px 0px 0px round 6px);

          .info-connect, .info-progress {
            transform: translateX(-36px);
          }
        }
      }

      > .download-item-content {
        width: 100%;
        height: 100%;
        position: relative;
        border-radius: 6px;
        background: rgba(240, 240, 240, 1);
        box-shadow: 2px 2px 8px rgba(100, 100, 100, .1);
        cursor: pointer;
        overflow: hidden;
        transition: all .1s ease-out;
        z-index: 2;
        clip-path: inset(0);
      }

      > .download-item-tools {
        cursor: pointer;
        position: absolute;
        top: 0;
        right: 0;
        z-index: 1;
        width: 24px;
        display: flex;
        align-items: center;
        height: 100%;
      }

      > .el-checkbox {
        width: 30px;

        .el-checkbox__label {
          display: none;
        }
      }

      .list-item-progress, .list-item-info {
        position: absolute;
        height: 100%;
        width: 100%;
      }

      .list-item-progress {
        z-index: 2;
        background: rgba(135, 244, 130, .4);
      }

      .pause {
        background: rgba(236, 200, 126, .4);
      }

      .list-item-info {
        display: flex;
        justify-content: space-between;

        > span {
          display: flex;
          align-items: center;
          padding: 20px;
        }

        .info-progress, .info-connect {
          transition: transform .1s ease-out;
        }
      }
    }
  }
}
</style>
