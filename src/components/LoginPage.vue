<script setup>
import { reactive } from 'vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false
  },
  errorMessage: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['login'])

const formData = reactive({
  username: '',
  password: ''
})

const handleSubmit = () => {
  emit('login', {
    username: formData.username,
    password: formData.password
  })
}
</script>

<template>
  <section class="login-shell">
    <div class="login-card">
      <div class="login-brand">HXL</div>
      <h1>系统登录</h1>
      <p class="login-subtitle">请输入用户名和密码后进入标签系统</p>

      <div class="form-stack">
        <input
          v-model="formData.username"
          class="login-input"
          type="text"
          autocomplete="username"
          placeholder="用户名"
          @keyup.enter="handleSubmit"
        >

        <input
          v-model="formData.password"
          class="login-input"
          type="password"
          autocomplete="current-password"
          placeholder="密码"
          @keyup.enter="handleSubmit"
        >
      </div>

      <p v-if="props.errorMessage" class="login-error">{{ props.errorMessage }}</p>

      <button
        type="button"
        class="login-btn"
        :disabled="props.loading"
        @click="handleSubmit"
      >
        {{ props.loading ? '登录中...' : '登录' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.login-shell {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  width: 100%;
  max-width: 420px;
  padding: 32px 28px;
  box-sizing: border-box;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(214, 223, 236, 0.9);
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
}

.login-brand {
  width: 52px;
  height: 52px;
  margin-bottom: 18px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3370ff 0%, #6f8dff 100%);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 1px;
}

.login-card h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1f2329;
}

.login-subtitle {
  margin: 10px 0 24px;
  font-size: 14px;
  line-height: 1.7;
  color: #667085;
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login-input {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  box-sizing: border-box;
  border: 1px solid #d0d7e2;
  border-radius: 10px;
  background: #fff;
  font-size: 14px;
  color: #1f2329;
  outline: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.login-input:focus {
  border-color: #7aa2ff;
  box-shadow: 0 0 0 3px rgba(51, 112, 255, 0.12);
}

.login-error {
  margin: 14px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: #d92d20;
}

.login-btn {
  width: 100%;
  height: 44px;
  margin-top: 20px;
  border: 0;
  border-radius: 10px;
  background: linear-gradient(135deg, #3370ff 0%, #5b7dff 100%);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 12px 24px rgba(51, 112, 255, 0.24);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  box-shadow: none;
}
</style>
