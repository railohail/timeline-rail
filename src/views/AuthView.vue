<template>
  <div>
    <LoginForm
      v-if="currentView === 'login'"
      @switch-to-register="currentView = 'register'"
    />
    <RegisterForm
      v-else
      @switch-to-login="currentView = 'login'"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import LoginForm from '@/components/LoginForm.vue'
import RegisterForm from '@/components/RegisterForm.vue'

const currentView = ref<'login' | 'register'>('login')
</script>
