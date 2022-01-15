<template>
  <div id="download-panel">
    <h4>下载文件</h4>
    <div>
      信息：{{ msg }}
    </div>
    <div class="home-aside-quota">
      <el-progress :text-inside="true" :stroke-width="26" :percentage="process"/>
    </div>
  </div>
</template>

<script setup>
import {defineProps} from 'vue'

defineProps({
  process: Number,
  msg: String
})

// const emit = defineEmits(['change', 'delete'])
</script>

<style lang="less" scoped>
#download-panel {
  height: 300px;
  width: 300px;
  background: #fff;
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 3;
  border: 1px solid #ccc;
  border-radius: 12px;
  transform: translate(-50%, -50%);
  padding: 12px;

  > div {
    margin-top: 24px;
  }
}
</style>
