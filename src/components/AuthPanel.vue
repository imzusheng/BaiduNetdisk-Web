<template>
  <div id="authDialog">
    <el-dialog
        :width="'60%'"
        v-model="dialogVisible"
        :showClose="false"
        :close-on-click-modal="false"
        :close-on-press-escape="false">
      <template #title>
        <p style="display: flex; align-items: center; justify-content: flex-start">
          验证信息
          &nbsp;&nbsp;
          <span style="color: rgba(100,100,100, .4)">{{ authJsonPath }}</span>
        </p>
      </template>

      <el-form
          label-position="right"
          label-width="160px"
          ref="formDataRef"
          :model="formData"
          :rules="rules"
      >

        <el-form-item label="AppKey" prop="AppKey">
          <el-input v-model="formData.AppKey" placeholder="请输入AppKey"></el-input>
        </el-form-item>
        <el-form-item label="SecretKey" prop="SecretKey">
          <el-input v-model="formData.SecretKey" placeholder="请输入SecretKey"></el-input>
        </el-form-item>
        <el-form-item label="Authorization Code" prop="Code" ref="CodeRef">
          <el-input v-model="formData.Code" placeholder="通过下方链接获取Authorization Code"></el-input>
        </el-form-item>
        <el-form-item>
          <a :href="codeUrl" target="_blank" style="color: rgb(64,158,255)">{{ codeUrl }}</a>
        </el-form-item>
        <el-form-item>
          <el-button @click="reset">重置</el-button>
          <el-button type="default" @click="onClear(formDataRef)">清空</el-button>
          <el-button type="primary" @click="onSubmit(formDataRef)">确定</el-button>
        </el-form-item>

      </el-form>

    </el-dialog>
  </div>
</template>

<script setup>
import {useStore} from "vuex"
import {computed, reactive, ref, toRaw, watchEffect} from "vue"
import {ElMessage} from "element-plus"

const store = useStore()
// 登录面板是否显示
const dialogVisible = computed(() => store.state.dialogVisible)
// auth.json路径
const authJsonPath = computed(() => {
  return store.state.authJsonPath.replace('file:///', '')
})
// 表单ref
const formDataRef = ref()
const CodeRef = ref()
// 表单数据
const formData = reactive({
  AppKey: '',
  SecretKey: '',
  Code: ''
})
// 表单验证规则
const rules = reactive({
  AppKey: [
    {
      required: true,
      message: '请输入AppKey',
      trigger: 'blur',
    }
  ],
  SecretKey: [
    {
      required: true,
      message: '请输入SecretKey',
      trigger: 'blur',
    }
  ],
  Code: [
    {
      required: true,
      message: '点击链接获取Authorization Code并粘贴到此处',
      trigger: 'blur',
    }
  ]
})
// 提交验证表单
const onSubmit = formRef => {
  formRef
      .validate()
      .then(validate => {
        if (validate) {
          const {Code} = toRaw(formData)
          store.dispatch('postAccessToken', Code).then(res => {
            if (res.error) {
              CodeRef.value.resetField()
              ElMessage.error({
                dangerouslyUseHTMLString: true,
                message: `<div>
                  <h4 style="margin-bottom: 12px">Authorization Code无效</h4>
                  <p>${res.msg.error}: ${res.msg.error_description}</p>
                </div>`,
              })
            } else {
              window.location.reload()
            }
          })
        }
      })
}
// 重设表单
const reset = () => {
  formData.AppKey = toRaw(store.state.auth.AppKey)
  formData.SecretKey = toRaw(store.state.auth.SecretKey)
}
// 清空表单
const onClear = formRef => formRef.resetFields()
// 获取Authorization code url
const codeUrl = computed(() => {
  if (formData.AppKey) return `https://openapi.baidu.com/oauth/2.0/authorize?response_type=code&client_id=${formData.AppKey}&redirect_uri=oob&scope=basic,netdisk&display=page&qrcode=1&force_login=1`
  else return ''
})

watchEffect(() => {
  formData.AppKey = toRaw(store.state.auth.AppKey)
  formData.SecretKey = toRaw(store.state.auth.SecretKey)
})

</script>

<style lang="less">
#authDialog {
  position: relative;
  z-index: 2004;

  .el-dialog__header {
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(100, 100, 100, .2);
  }
}
</style>
