<!--
  主页默认布局
  包含头部header、侧边栏aside以及菜单导航
-->

<template>

  <AuthPanel :dialogVisible="false"/>

  <el-container :id="'HomeOverview'" :style="{filter: store.state.dialogVisible ? 'blur(10px)' : 'none'}">

    <el-header :class="'home-header'">
      <div>
        <!--   开关 s   -->
        <div class="drawer-switch user-select-not" @click="menuShow = !menuShow"
             v-if="$router.currentRoute.value.name !== 'FilePlayer'">
          <Menu style="height: 32px; width: 32px;" :style="{color: menuShow ? '#f2f2f2': '#ccc'}"/>
        </div>
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
      </div>
      <!--   搜索栏 s  -->
      <div class="home-header-search" v-if="$router.currentRoute.value.name === 'HomeOverview'">
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

      <el-drawer
          v-if="$router.currentRoute.value.name !== 'FilePlayer'"
          direction="ltr"
          :modal="false"
          :modal-class="'drawer-modal'"
          :close-on-click-modal="false"
          :close-on-press-escape="false"
          :lock-scroll="false"
          :show-close="false"
          :z-index="3"
          :size="'300px'"
          v-model="menuShow"
          :with-header="false">
        <!--  菜单 s -->
        <el-menu
            :default-active="$router.currentRoute.value.path.replace('/','')"
            :class="'home-aside-menu user-select-not'"
            class="el-menu-vertical-demo"
            @select="menuSelect"
            mode="vertical">
          <!-- 菜单 所有文件 s -->
          <el-menu-item index="overview">
            <house style="width: 16px; height: 16px; cursor: pointer"/>
            <span style="width: 8px"></span>
            <span>所有文件</span>
          </el-menu-item>
          <!-- 文件分类 s -->
          <el-sub-menu index="category">
            <template #title>
              <tickets style="width: 16px; height: 16px; cursor: pointer"/>
              <span style="width: 8px"></span>
              <span>文件分类</span>
            </template>
            <el-menu-item index="imagelist">图片</el-menu-item>
            <el-menu-item index="videolist">视频</el-menu-item>
            <el-menu-item index="doclist">文档</el-menu-item>
            <el-menu-item index="btlist">bt种子</el-menu-item>
          </el-sub-menu>
          <!-- 菜单 下载任务 s -->
          <el-menu-item index="download">
            <odometer style="width: 16px; height: 16px; cursor: pointer"/>
            <span style="width: 8px"></span>
            <el-badge :value="downloadSum" :max="999" v-if="downloadSum >0">
              <span>下载任务</span>
            </el-badge>
            <span v-else>下载中</span>
          </el-menu-item>
          <!-- 菜单 已下载 s -->
          <el-menu-item index="transmit">
            <download style="width: 16px; height: 16px; cursor: pointer"/>
            <span style="width: 8px"></span>
            <span>已下载（{{ localFilesSum }}）</span>
          </el-menu-item>
        </el-menu>
        <!--  配额 s  -->
        <div class="home-aside-quota">
          <el-progress :text-inside="true" :stroke-width="26" :percentage="parseInt(quotaInfo.rate) || 0"/>
          <span>{{ quotaInfo.used }}/{{ quotaInfo.total }}</span>
        </div>
      </el-drawer>

      <!--  占位div s    -->
      <div class="menu-perch" v-if="menuShow && $router.currentRoute.value.name !== 'FilePlayer'"/>

      <!-- 路由主内容 s -->
      <router-view v-if="$router.currentRoute.value.meta.keepalive" v-slot="{ Component }">
        <keep-alive>
          <component :is="Component"/>
        </keep-alive>
      </router-view>
      <!-- 路由主内容 e -->

    </el-container>

  </el-container>

</template>

<script setup>
import {computed, onMounted, ref} from 'vue'
import {House, Download, Odometer, Search, Tickets, Menu} from '@element-plus/icons-vue'
import {useStore} from "vuex"
import {useRouter} from "vue-router"
import {ElLoading} from 'element-plus'
import AuthPanel from '@/components/AuthPanel'

const store = useStore()
const router = useRouter()
const menuShow = ref(true)

// 全屏加载动画
let loadingInstance

onMounted(() => {
  // 全屏加载动画
  loadingInstance = ElLoading.service({fullscreen: true, text: '正在登录'})

  // 第一步 获取权限(access_token)
  store.dispatch('getAuth').then(() => {
    if (store.state.auth['access_token']) {
      // 第二步 获取用户信息(需要uk)
      // api需要获取用户唯一标识uk之后才能使用
      store.dispatch('getUserInfo').then(() => {
        loadingInstance.close() // 关闭加载动画
        if (router.currentRoute.value.name !== 'FilePlayer') { // 如果是视频播放页面,则不用加载
          store.dispatch('getUndoneList') // 获取未下载完成的任务列表
          store.dispatch('getLocalFiles') // 获取本地已下载的文件信息
        }
      })
      // (不需要uk)但需要access_token
      store.dispatch('getQuotaInfo') // 获取配额，容量信息
      // 处理搁置的请求
      store.dispatch('shelveGet')
    } else {
      loadingInstance.close() // 关闭加载动画
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

// 菜单选择
const menuSelect = index => {
  router.replace({
    path: `/${index}`
  })
}

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
// 抽屉
.drawer-modal {
  width: 300px;

  .el-drawer {
    box-shadow: 2px 2px 8px rgba(100, 100, 100, 0.1), 0 0 8px #fff;
    overflow: inherit;
    transition: none !important;

    .el-drawer__body {
      overflow: inherit !important;
      padding: 60px 0 0 !important;
      display: flex;
      overflow: hidden;
      flex-direction: column;
      justify-content: space-between;
      position: relative;

      //菜单
      .home-aside-menu {
        flex: 1;
        border: none !important;
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
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 2px 2px 8px rgba(100, 100, 100, .1),
    0 0 8px #fff;
    background: #ffffff;
    position: relative;

    > div {
      display: flex;
    }

    // 开关
    .drawer-switch {
      height: 40px;
      width: 40px;
      min-width: 40px;
      min-height: 40px;
      cursor: pointer;
      margin-right: 30px;
      display: flex;
      justify-content: center;
      align-items: center;

      > svg {
        &:hover {
          color: rgba(64, 158, 255, 1) !important;
        }
      }
    }

    // 头像
    .home-header-avatar {
      display: flex;
      align-items: center;
      margin-right: 30px;

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
        border-radius: 4px;
        overflow: hidden;
        //border: 1px solid #dcdfe6;

        div, .el-input__inner {
          border: none;
        }

        .el-input__inner {
          background: rgba(240, 240, 240, .2);
        }
      }
    }

    @media screen and (max-width: 768px) {
      & {
        padding: 6px 12px;
        height: auto;
        flex-wrap: wrap;

        > div {
          width: 100%;
          justify-content: space-between;

          .home-header-avatar {
            margin: 0;
          }
        }

        .home-header-search {
          display: none;
        }
      }
    }
  }

  // 内容
  .el-container {
    .menu-perch {
      width: 300px;
      min-width: 300px
    }
  }

  @media screen and (max-width: 768px) {
    .el-container {
      .menu-perch {
        display: none;
      }
    }
  }
}
</style>
