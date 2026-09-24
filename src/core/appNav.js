import { ref } from 'vue'

// 供各页面（如个人中心）切换侧边栏当前视图
export const activeTab = ref('dashboard')

export function navigate(tab) {
  activeTab.value = tab
}
