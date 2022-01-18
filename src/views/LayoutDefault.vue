<!--
  主页默认布局
  包含头部header、侧边栏aside以及菜单导航
-->

<template>

  <AuthPanel :dialogVisible="false"/>

  <el-container :id="'HomeOverview'">

    <el-header :class="'home-header'">
      <!--  头像信息 s -->
      <div class="home-header-avatar">
        <el-avatar :size="36" :src="userInfo.avatar_url"/>
        <span class="header-avatar-name">
            {{ userInfo.baidu_name }}
          <span class="header-vip-type">
            {{
              ['普通用户', '普通会员', '超级会员'].filter((v, k) => k === userInfo.vip_type)[0]
            }}
            &nbsp;&nbsp;&nbsp;&nbsp;
            <el-popconfirm
                title="将清除 access_token，你确定吗?"
                confirmButtonText="确定"
                cancelButtonText="取消"
                @confirm="logout"
            >
              <template #reference>
                <el-button size="small">
                  <span style="color: #409eff; cursor: pointer">退出登录</span>
                </el-button>
              </template>
            </el-popconfirm>
          </span>
        </span>
      </div>

      <!--   搜索栏 s  -->
      <div class="home-header-search">
        <el-input
            v-model="searchInput"
            placeholder="搜索网盘文件"
            class="input-with-select"
            clearable
        >
          <template #prepend>
            <el-select v-model="searchSelect" placeholder="搜索目录" style="width: 110px">
              <el-option label="根目录" value="根目录"/>
              <el-option label="当前目录" value="当前目录"/>
            </el-select>
          </template>
          <template #append>
            <el-button :icon="Search" @click="searchFiles"></el-button>
          </template>
        </el-input>
      </div>
    </el-header>

    <el-container>

      <!--  侧边栏 s  -->
      <el-aside :class="'home-aside'">
        <!--  菜单 s -->
        <el-menu
            :default-active="$router.currentRoute.value.path.replace('/','')"
            :class="'home-aside-menu'"
            class="el-menu-vertical-demo"
            mode="vertical">
          <el-menu-item index="overview" @click="$router.replace('/overview')">
            <house
                style="width: 16px; height: 16px; cursor: pointer"/>
            <span style="width: 8px"></span>
            <span>
              所有文件
            </span>
          </el-menu-item>
          <el-menu-item index="download" @click="$router.replace('/download')">
            <odometer style="width: 16px; height: 16px; cursor: pointer"/>
            <span style="width: 8px"></span>
            <el-badge :value="downloadSum" :max="999" v-if="downloadSum >0">
              <span>下载任务</span>
            </el-badge>
            <span v-else>下载中</span>
          </el-menu-item>
          <el-menu-item index="transmit" @click="$router.replace('/transmit')">
            <download
                style="width: 16px; height: 16px; cursor: pointer"/>
            <span style="width: 8px"></span>
            <span>
              已下载（{{ localFilesSum }}）
            </span>
          </el-menu-item>
        </el-menu>
        <!--  菜单 e -->
        <!--  配额 s  -->
        <div class="home-aside-quota">
          <el-progress :text-inside="true" :stroke-width="26" :percentage="parseInt(quotaInfo.rate) || 0"/>
          <span>{{ quotaInfo.used }}/{{ quotaInfo.total }}</span>
        </div>
        <!--  配额 e  -->
      </el-aside>
      <!--  侧边栏 e  -->

      <!-- 路由主内容 s -->
      <router-view v-if="$router.currentRoute.value.meta.keepalive" v-slot="{ Component }">
        <keep-alive>
          <component :is="Component"/>
        </keep-alive>
      </router-view>

    </el-container>

  </el-container>

</template>

<script setup>
import {computed, onMounted, ref} from 'vue'
import {House, Download, Odometer, Search} from '@element-plus/icons-vue'
import {useStore} from "vuex"
import {ElLoading} from 'element-plus'
import AuthPanel from '@/components/AuthPanel'

const store = useStore()

// 全屏加载动画
let loadingInstance

onMounted(() => {
  // 全屏加载动画
  loadingInstance = ElLoading.service({
    fullscreen: true,
    text: '正在登录'
  })

  // 第一步 获取权限(access_token)
  store.dispatch('getAuth').then(() => {
    if (store.state.auth['access_token']) {
      // 第二步 获取用户信息(需要uk)
      // api需要获取用户唯一标识uk之后才能使用
      store.dispatch('getUserInfo').then(() => {
        loadingInstance.close() // 关闭加载动画
        store.dispatch('getUndoneList') // 获取未下载完成的任务列表
        store.dispatch('getLocalFiles') // 获取本地已下载的文件信息
      })
      // (不需要uk)但需要access_token
      store.dispatch('getQuotaInfo') // 获取配额，容量信息
      store.dispatch('getFilesList') // 获取文件列表
    } else {
      store.state.dialogVisible = true
    }
  })
})

// 用户信息
const userInfo = computed(() => store.state.userInfo)
// 当前下载任务数量
const downloadSum = computed(() => Object.keys(store.state.download).length)
// 已下载的文件数量
const localFilesSum = computed(() => store.state.listLocalFiles.length)
// 配额，容量信息
const quotaInfo = computed(() => store.state.quotaInfo)
// 搜索内容
const searchInput = ref('')
// 搜索位置
const searchSelect = ref('当前目录')
// 搜索文件
const searchFiles = () => {
  if (searchInput.value) {
    store.dispatch('getSearch', {
      value: searchInput.value,
      dir: searchSelect.value === '根目录' ? '/' : store.state.fileListBreadcrumb.join('/').replaceAll('全部文件', '')
    })
  }
}

// 退出登录
const logout = () => {
  console.log('run')
  store.dispatch('logout').then(() => {
    window.location.reload()
  })
}

</script>

<style lang="less">
.el-loading-spinner {
  .el-loading-text {
    text-align: center;
  }
}

#HomeOverview {
  width: 100%;
  height: 100vh;

  // 头部
  .home-header {
    width: 100%;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    box-shadow: 2px 2px 8px rgba(100, 100, 100, .1),
    0 0 8px #fff;

    // 头像
    .home-header-avatar {
      display: flex;
      align-items: center;

      .header-avatar-name {
        margin-left: 16px;
        font-size: 14px;
      }

      .header-vip-type {
        font-size: 12px;
        margin-left: 4px;
        color: #999;
      }
    }

    // 搜索栏
    .home-header-search {
      display: flex;
      justify-content: center;
      align-items: center;

      .el-input-group__append {
        background: rgba(64, 158, 255, 1);

        .el-button {
          margin-top: -3px;

          svg, i {
            color: #fff;
          }
        }
      }

      > .el-input {
        border-radius: 20px;
        overflow: hidden;
        border: 1px solid #dcdfe6;

        div, .el-input__inner {
          border: none;
        }
      }
    }
  }

  // 内容
  .el-container {

    // 侧边栏
    .home-aside {
      width: 300px;
      display: flex;
      overflow: hidden;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 2px 2px 8px rgba(100, 100, 100, .1),
      0 0 8px #fff;

      // 菜单折叠按钮
      .home-aside-collapse {
        padding: 20px;
        border-bottom: 1px solid rgba(100, 100, 100, .1);
      }

      //菜单
      .home-aside-menu {
        flex: 1;
        border: none;
        background: transparent;
        margin-top: 12px;

        .el-badge__content {
          top: 50%;
          transform: translate(170%, -55%);
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .is-active {
          svg {
            color: #409eff;
          }
        }
      }

      // 剩余配额
      .home-aside-quota {
        margin: 20px;

        > span {
          font-size: 13px;
          text-align: right;
          display: block;
          color: #999;
          padding: 12px 0 0;
        }
      }

    }

  }
}
</style>
