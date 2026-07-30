<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { supabase } from './supabase'

// Check if Supabase client is properly configured
const isSupabaseConfigured = computed(() => {
  const url = import.meta.env.VITE_SUPABASE_URL || window.SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY
  return !!(url && key)
})

// State variables
const records = ref([])
const activeTab = ref('pending') // 'pending' or 'completed'
const inputPlatform = ref('xhs') // default 'xhs' (小红书)
const inputAccountId = ref('')
const isSubmitting = ref(false)
const isLoading = ref(false)
const inputRef = ref(null)
const dateInputRef = ref(null)
const searchQuery = ref('')
const selectedDate = ref('') // Stores date in 'YYYY-MM-DD' format

const showDatePicker = () => {
  if (dateInputRef.value && typeof dateInputRef.value.showPicker === 'function') {
    try {
      dateInputRef.value.showPicker()
    } catch (err) {
      console.warn('HTML5 showPicker error:', err)
    }
  }
}

// Toast Notification State
const toast = ref({
  show: false,
  message: '',
  type: 'success' // 'success' | 'error' | 'info'
})
let toastTimer = null

const showToast = (message, type = 'success') => {
  if (toastTimer) clearTimeout(toastTimer)
  toast.value = { show: true, message, type }
  toastTimer = setTimeout(() => {
    toast.value.show = false;
  }, 2500)
}

// Platforms metadata
const platforms = {
  xhs: {
    name: '小红书',
    icon: '📕',
    badgeClass: 'bg-red-50 text-red-600 border border-red-100',
    color: '#ff2442'
  },
  dy: {
    name: '抖音',
    icon: '🎵',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    color: '#0f172a'
  },
  bili: {
    name: 'B站',
    icon: '📺',
    badgeClass: 'bg-pink-50 text-pink-600 border border-pink-100',
    color: '#fb7299'
  }
}

// Fetch all records from Supabase
const fetchRecords = async () => {
  if (!isSupabaseConfigured.value) return
  
  isLoading.value = true
  try {
    const { data, error } = await supabase
      .from('follow_records')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    records.value = data || []
  } catch (error) {
    console.error('Error fetching records:', error)
    showToast('获取数据失败: ' + error.message, 'error')
  } finally {
    isLoading.value = false
  }
}

// Insert new follow record
const handleAddFollow = async () => {
  if (!inputAccountId.value.trim()) {
    showToast('请输入账号 ID 或昵称', 'info')
    return
  }
  
  if (!isSupabaseConfigured.value) {
    showToast('Supabase 未配置，无法添加', 'error')
    return
  }

  isSubmitting.value = true
  const newRecord = {
    platform: inputPlatform.value,
    account_id: inputAccountId.value.trim(),
    status: 'pending'
  }

  try {
    const { data, error } = await supabase
      .from('follow_records')
      .insert([newRecord])
      .select()

    if (error) throw error

    if (data && data.length > 0) {
      records.value.unshift(data[0])
    } else {
      await fetchRecords()
    }

    showToast('添加关注成功', 'success')
    inputAccountId.value = ''
    
    // Clear focus from input box
    if (inputRef.value) {
      inputRef.value.blur()
    }
  } catch (error) {
    console.error('Error adding record:', error)
    showToast('添加失败: ' + error.message, 'error')
  } finally {
    isSubmitting.value = false
  }
}

// Update follow record status
const handleUpdateStatus = async (id, newStatus) => {
  if (!isSupabaseConfigured.value) return

  try {
    // Optimistic UI Update
    const recordIndex = records.value.findIndex(r => r.id === id)
    let oldStatus = ''
    if (recordIndex !== -1) {
      oldStatus = records.value[recordIndex].status
      records.value[recordIndex].status = newStatus
    }

    const { error } = await supabase
      .from('follow_records')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      // Revert if error
      if (recordIndex !== -1) {
        records.value[recordIndex].status = oldStatus
      }
      throw error
    }

    showToast('状态已更新', 'success')
  } catch (error) {
    console.error('Error updating status:', error)
    showToast('更新状态失败: ' + error.message, 'error')
  }
}

// Delete follow record
const handleDeleteRecord = async (id) => {
  if (!confirm('确定要删除这条记录吗？')) return
  if (!isSupabaseConfigured.value) return

  try {
    const { error } = await supabase
      .from('follow_records')
      .delete()
      .eq('id', id)

    if (error) throw error

    records.value = records.value.filter(r => r.id !== id)
    showToast('记录已删除', 'success')
  } catch (error) {
    console.error('Error deleting record:', error)
    showToast('删除失败: ' + error.message, 'error')
  }
}

// Copy ID to clipboard helper
const copiedId = ref(null)
const handleCopyId = async (id, text) => {
  try {
    await navigator.clipboard.writeText(text)
    copiedId.value = id
    showToast('账号 ID 已复制', 'success')
    setTimeout(() => {
      if (copiedId.value === id) {
        copiedId.value = null
      }
    }, 2000)
  } catch (err) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      copiedId.value = id
      showToast('账号 ID 已复制', 'success')
      setTimeout(() => {
        if (copiedId.value === id) {
          copiedId.value = null
        }
      }, 2000)
    } catch (e) {
      showToast('复制失败，请手动复制', 'error')
    }
    document.body.removeChild(textarea)
  }
}

// Relative time formatting
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) {
    return '刚刚'
  } else if (diffMin < 60) {
    return `${diffMin}分钟前`
  } else if (diffHour < 24) {
    return `${diffHour}小时前`
  } else {
    return `${diffDay}天前`
  }
}

// Convert UTC created_at to local YYYY-MM-DD string
const getLocalDateString = (isoString) => {
  if (!isoString) return ''
  const dateObj = new Date(isoString)
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Date Filter check
const matchesDateFilter = (createdAt) => {
  if (!selectedDate.value) return true
  return getLocalDateString(createdAt) === selectedDate.value
}

// Count statistics for the lists (with date filter applied)
const stats = computed(() => {
  const pendingCount = records.value.filter(r => 
    (r.status === 'pending' || r.status === 'review') && matchesDateFilter(r.created_at)
  ).length
  const completedCount = records.value.filter(r => 
    (r.status === 'success' || r.status === 'failed') && matchesDateFilter(r.created_at)
  ).length
  return { pendingCount, completedCount }
})

// Filtered and searched records mapping
const filteredRecords = computed(() => {
  let list = []
  if (activeTab.value === 'pending') {
    list = records.value.filter(r => r.status === 'pending' || r.status === 'review')
  } else {
    list = records.value.filter(r => r.status === 'success' || r.status === 'failed')
  }
  
  // Date filter
  list = list.filter(r => matchesDateFilter(r.created_at))
  
  // Search query filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(r => 
      r.account_id.toLowerCase().includes(q) || 
      (platforms[r.platform]?.name || '').toLowerCase().includes(q)
    )
  }
  
  return list
})

// Auto refresh relative times periodically
let timeInterval = null
onMounted(() => {
  fetchRecords()
  timeInterval = setInterval(() => {
    records.value = [...records.value]
  }, 60000)
})

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased max-w-md mx-auto relative shadow-2xl border-x border-slate-200/80 pb-10">
    
    <!-- Toast Message Component -->
    <div 
      v-if="toast.show" 
      class="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm rounded-2xl p-4 shadow-xl border backdrop-blur-md transition-all duration-300 transform scale-100 flex items-center gap-3"
      :class="{
        'bg-emerald-50 text-emerald-800 border-emerald-200/80': toast.type === 'success',
        'bg-rose-50 text-rose-800 border-rose-200/80': toast.type === 'error',
        'bg-slate-50 text-slate-800 border-slate-200/80': toast.type === 'info'
      }"
    >
      <span class="text-xl">
        <template v-if="toast.type === 'success'">✨</template>
        <template v-else-if="toast.type === 'error'">🚨</template>
        <template v-else>💡</template>
      </span>
      <p class="text-sm font-semibold leading-tight">{{ toast.message }}</p>
    </div>

    <!-- Header Section -->
    <header class="sticky top-0 bg-white/90 backdrop-blur-md z-30 border-b border-slate-200/60 px-5 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-md shadow-rose-500/10">
          <span class="text-base text-white">🤝</span>
        </div>
        <div>
          <h1 class="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">自媒体互关助手</h1>
          <p class="text-[10px] text-slate-400 font-semibold">Mutual-Follow Tracker</p>
        </div>
      </div>
      <button 
        @click="fetchRecords" 
        :disabled="isLoading"
        class="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all text-slate-500 disabled:opacity-50 disabled:pointer-events-none tap-highlight-transparent"
        title="刷新列表"
      >
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          class="h-4 w-4" 
          :class="{ 'animate-spin text-rose-500': isLoading }" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.253 8H18" />
        </svg>
      </button>
    </header>

    <!-- Supabase Not Configured Warning -->
    <div v-if="!isSupabaseConfigured" class="m-4 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col gap-3 shadow-sm">
      <div class="flex items-center gap-2 font-bold text-amber-700">
        <span>⚠️</span>
        <h3>Supabase 数据库未配置</h3>
      </div>
      <p class="text-xs leading-relaxed text-amber-800">
        请在项目根目录创建 <code class="bg-amber-100 px-1.5 py-0.5 rounded text-amber-700">.env.local</code> 文件，并配置以下密钥：
      </p>
      <pre class="bg-white p-3 rounded-xl text-[10px] text-slate-600 border border-slate-200 overflow-x-auto">VITE_SUPABASE_URL=你的SupabaseUrl
VITE_SUPABASE_ANON_KEY=你的AnonKey</pre>
    </div>

    <!-- Top Input Form -->
    <section class="p-4 flex flex-col gap-3 border-b border-slate-200/60 bg-white/60">
      <div class="flex gap-2">
        <!-- Platform Selector -->
        <div class="relative w-1/3">
          <select 
            v-model="inputPlatform"
            class="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none appearance-none focus:border-rose-500/40 transition-all text-center tap-highlight-transparent cursor-pointer"
          >
            <option value="xhs">📕 小红书</option>
            <option value="dy">🎵 抖音</option>
            <option value="bili">📺 B站</option>
          </select>
          <div class="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-400 text-[10px]">
            ▼
          </div>
        </div>

        <!-- Account ID Input -->
        <div class="flex-1 relative">
          <input 
            ref="inputRef"
            v-model="inputAccountId"
            type="text" 
            placeholder="输入账号 ID 或昵称" 
            @keyup.enter="handleAddFollow"
            class="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/10 transition-all"
          />
          <button 
            v-if="inputAccountId" 
            @click="inputAccountId = ''" 
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm"
          >
            ✕
          </button>
        </div>
      </div>

      <!-- Add Button -->
      <button 
        @click="handleAddFollow" 
        :disabled="isSubmitting || !inputAccountId.trim()"
        class="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.99] transition-all shadow-md shadow-rose-500/10 disabled:opacity-50 disabled:pointer-events-none tap-highlight-transparent"
      >
        <span v-if="isSubmitting" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        <span v-else>➕</span>
        添加关注
      </button>
    </section>

    <!-- Search bar & Date filter (Elegantly aligned in side-by-side flex layout) -->
    <div class="px-4 pt-3.5 pb-1.5 flex gap-2" v-if="records.length > 0">
      <!-- Search Input -->
      <div class="flex-1 relative">
        <input 
          v-model="searchQuery"
          type="text"
          placeholder="搜索账号 ID..."
          class="w-full h-9 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-slate-300 transition-all"
        />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
        <button 
          v-if="searchQuery" 
          @click="searchQuery = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
        >
          ✕
        </button>
      </div>

      <!-- Date Input Picker with Reset Button -->
      <div class="flex items-center gap-1 shrink-0">
        <div class="relative shrink-0 flex items-center">
          <input 
            ref="dateInputRef"
            v-model="selectedDate"
            type="date"
            @click="showDatePicker"
            class="h-9 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-300 transition-all cursor-pointer w-28 text-center"
          />
          <div 
            v-if="!selectedDate"
            class="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-semibold text-slate-400 bg-white rounded-xl border border-slate-200"
          >
            📅 日期
          </div>
        </div>
        <button 
          v-if="selectedDate" 
          @click="selectedDate = ''"
          class="w-7 h-9 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center text-xs active:bg-slate-50 transition-all"
          title="清除日期筛选"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav class="p-4 flex">
      <div class="w-full bg-slate-200/50 p-1 rounded-xl flex border border-slate-200/40">
        <!-- Pending Tab Button -->
        <button 
          @click="activeTab = 'pending'"
          class="flex-1 py-2 text-center rounded-lg text-xs font-semibold tracking-wide transition-all relative flex items-center justify-center gap-2 tap-highlight-transparent"
          :class="activeTab === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          <span>⏳ 待处理</span>
          <span 
            v-if="stats.pendingCount > 0" 
            class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-600 border border-slate-300/30 min-w-[16px] text-center"
          >
            {{ stats.pendingCount }}
          </span>
        </button>

        <!-- Completed Tab Button -->
        <button 
          @click="activeTab = 'completed'"
          class="flex-1 py-2 text-center rounded-lg text-xs font-semibold tracking-wide transition-all relative flex items-center justify-center gap-2 tap-highlight-transparent"
          :class="activeTab === 'completed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
        >
          <span>✅ 已完成</span>
          <span 
            v-if="stats.completedCount > 0" 
            class="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-200 text-slate-600 border border-slate-300/30 min-w-[16px] text-center"
          >
            {{ stats.completedCount }}
          </span>
        </button>
      </div>
    </nav>

    <!-- Records List Area -->
    <main class="flex-1 px-4 overflow-y-auto">
      
      <!-- Empty State -->
      <div 
        v-if="filteredRecords.length === 0" 
        class="py-16 flex flex-col items-center justify-center text-center gap-3 animate-fade-in"
      >
        <span class="text-4xl filter drop-shadow">📭</span>
        <h3 class="text-sm font-semibold text-slate-400">暂无相关关注记录</h3>
        <p class="text-xs text-slate-500 max-w-[200px]">
          {{ searchQuery || selectedDate ? '未搜到对应记录，请重置过滤条件。' : '在上方输入自媒体账号并点击添加，即可开始追踪。' }}
        </p>
      </div>

      <!-- Card List with TransitionGroup for Premium feel -->
      <TransitionGroup 
        name="list" 
        tag="div" 
        class="flex flex-col gap-3"
      >
        <article 
          v-for="record in filteredRecords" 
          :key="record.id"
          class="p-4 bg-white border border-slate-100 hover:border-slate-200/80 rounded-2xl flex flex-col gap-3 transition-all duration-300 relative group overflow-hidden shadow-sm shadow-slate-100/50"
        >
          <!-- Platform Stripe color on left (adds visual polish) -->
          <div 
            class="absolute left-0 top-0 bottom-0 w-[3px]"
            :style="{ backgroundColor: platforms[record.platform]?.color || '#cbd5e1' }"
          ></div>

          <!-- Upper Row: Platform Badge & Time & Delete Action -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span 
                class="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center gap-1"
                :class="platforms[record.platform]?.badgeClass"
              >
                <span>{{ platforms[record.platform]?.icon }}</span>
                <span>{{ platforms[record.platform]?.name }}</span>
              </span>

              <!-- Status Badge (helps reading status in Completed tab) -->
              <span 
                v-if="activeTab === 'completed'"
                class="px-1.5 py-0.5 rounded text-[8px] font-bold"
                :class="{
                  'bg-emerald-50 text-emerald-600 border border-emerald-100': record.status === 'success',
                  'bg-rose-50 text-rose-600 border border-rose-100': record.status === 'failed'
                }"
              >
                {{ record.status === 'success' ? '互关成功' : '互关失败' }}
              </span>
              <span 
                v-else-if="record.status === 'review'"
                class="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-50 text-amber-600 border border-amber-100"
              >
                待核对 (review)
              </span>
            </div>
            
            <div class="flex items-center gap-2">
              <time class="text-[10px] text-slate-400 font-medium" :datetime="record.created_at">
                {{ formatRelativeTime(record.created_at) }}
              </time>
              <!-- Permanent delete button for mobile -->
              <button 
                @click="handleDeleteRecord(record.id)"
                class="text-slate-400 p-1 rounded text-xs tap-highlight-transparent"
                title="删除记录"
              >
                🗑️
              </button>
            </div>
          </div>

          <!-- Middle Row: Account ID with Copier -->
          <div class="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
            <span class="text-xs font-mono font-medium text-slate-700 select-all truncate max-w-[240px]">
              {{ record.account_id }}
            </span>
            <button 
              @click="handleCopyId(record.id, record.account_id)"
              class="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[10px] text-slate-505 flex items-center gap-1 active:bg-slate-50 transition-colors tap-highlight-transparent"
            >
              <span>{{ copiedId === record.id ? '✓' : '📋' }}</span>
              <span>{{ copiedId === record.id ? '已复制' : '复制' }}</span>
            </button>
          </div>

          <!-- Lower Row: Operations (Only shown in Pending tab) -->
          <div 
            v-if="activeTab === 'pending'"
            class="flex items-center justify-between gap-2 mt-1"
          >
            <!-- Review Button -->
            <button 
              @click="handleUpdateStatus(record.id, 'review')"
              :disabled="record.status === 'review'"
              class="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border tap-highlight-transparent"
              :class="record.status === 'review' 
                ? 'bg-indigo-50 text-indigo-600 border-indigo-100/50 cursor-default opacity-80' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 active:scale-[0.98]'"
            >
              <span>⌛</span>
              <span>待核对</span>
            </button>

            <!-- Success Button -->
            <button 
              @click="handleUpdateStatus(record.id, 'success')"
              class="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 active:scale-[0.98] tap-highlight-transparent"
            >
              <span>✓</span>
              <span>已互关</span>
            </button>

            <!-- Failed Button -->
            <button 
              @click="handleUpdateStatus(record.id, 'failed')"
              class="flex-1 h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all bg-white border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 active:scale-[0.98] tap-highlight-transparent"
            >
              <span>×</span>
              <span>未互关</span>
            </button>
          </div>

        </article>
      </TransitionGroup>
      
    </main>

    <!-- Footer decoration -->
    <footer class="mt-8 text-center text-[10px] text-slate-400">
      <p>自媒体互关管理工具 · 支持移动端快捷操作</p>
    </footer>
  </div>
</template>

<style>
/* Reset scrollbar styles for cleaner app UI */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
