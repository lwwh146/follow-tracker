<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { supabase } from "./supabase";

// Check if Supabase client is properly configured
const isSupabaseConfigured = computed(() => {
  const url = import.meta.env.VITE_SUPABASE_URL || window.SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;
  return !!(url && key);
});

// State variables
const records = ref([]);
const activeTab = ref("pending"); // 'pending', 'success', 'failed'
const inputPlatform = ref("xhs"); // default 'xhs' (小红书)
const inputAccountId = ref("");
const isSubmitting = ref(false);
const isLoading = ref(false);
const inputRef = ref(null);
const dateInputRef = ref(null);
const searchQuery = ref("");
const selectedDate = ref(""); // Stores date in 'YYYY-MM-DD' format

const showDatePicker = () => {
  if (
    dateInputRef.value &&
    typeof dateInputRef.value.showPicker === "function"
  ) {
    try {
      dateInputRef.value.showPicker();
    } catch (err) {
      console.warn("HTML5 showPicker error:", err);
    }
  }
};

// Toast Notification State
const toast = ref({
  show: false,
  message: "",
  type: "success", // 'success' | 'error' | 'info'
});
let toastTimer = null;

const showToast = (message, type = "success") => {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { show: true, message, type };
  toastTimer = setTimeout(() => {
    toast.value.show = false;
  }, 2500);
};

// Platforms metadata (更新为 Dot 样式点)
const platforms = {
  xhs: {
    name: "小红书",
    icon: "📕",
    dotClass: "bg-rose-500",
  },
  dy: {
    name: "抖音",
    icon: "🎵",
    dotClass: "bg-slate-800",
  },
  bili: {
    name: "B站",
    icon: "📺",
    dotClass: "bg-sky-400",
  },
};

// Fetch all records from Supabase
const fetchRecords = async () => {
  if (!isSupabaseConfigured.value) return;

  isLoading.value = true;
  try {
    const { data, error } = await supabase
      .from("follow_records")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    records.value = data || [];
  } catch (error) {
    console.error("Error fetching records:", error);
    showToast("获取数据失败: " + error.message, "error");
  } finally {
    isLoading.value = false;
  }
};

// Insert new follow record
const handleAddFollow = async () => {
  if (!inputAccountId.value.trim()) {
    showToast("请输入账号 ID 或昵称", "info");
    return;
  }

  if (!isSupabaseConfigured.value) {
    showToast("Supabase 未配置，无法添加", "error");
    return;
  }

  isSubmitting.value = true;
  const newRecord = {
    platform: inputPlatform.value,
    account_id: inputAccountId.value.trim(),
    status: "pending",
  };

  try {
    const { data, error } = await supabase
      .from("follow_records")
      .insert([newRecord])
      .select();

    if (error) throw error;

    if (data && data.length > 0) {
      records.value.unshift(data[0]);
    } else {
      await fetchRecords();
    }

    showToast("添加关注成功", "success");
    inputAccountId.value = "";

    if (inputRef.value) {
      inputRef.value.blur();
    }
  } catch (error) {
    console.error("Error adding record:", error);
    showToast("添加失败: " + error.message, "error");
  } finally {
    isSubmitting.value = false;
  }
};

// Update follow record status
const handleUpdateStatus = async (id, newStatus) => {
  if (!isSupabaseConfigured.value) return;

  try {
    const recordIndex = records.value.findIndex((r) => r.id === id);
    let oldStatus = "";
    if (recordIndex !== -1) {
      oldStatus = records.value[recordIndex].status;
      records.value[recordIndex].status = newStatus;
    }

    const { error } = await supabase
      .from("follow_records")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      if (recordIndex !== -1) {
        records.value[recordIndex].status = oldStatus;
      }
      throw error;
    }

    showToast("状态已更新", "success");
  } catch (error) {
    console.error("Error updating status:", error);
    showToast("更新状态失败: " + error.message, "error");
  }
};

// Delete follow record
const handleDeleteRecord = async (id) => {
  if (!confirm("确定要删除这条记录吗？")) return;
  if (!isSupabaseConfigured.value) return;

  try {
    const { error } = await supabase
      .from("follow_records")
      .delete()
      .eq("id", id);

    if (error) throw error;

    records.value = records.value.filter((r) => r.id !== id);
    showToast("记录已删除", "success");
  } catch (error) {
    console.error("Error deleting record:", error);
    showToast("删除失败: " + error.message, "error");
  }
};

// Copy ID to clipboard
const handleCopyId = async (id, text) => {
  try {
    await navigator.clipboard.writeText(text);
    showToast("账号 ID 已复制", "success");
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      showToast("账号 ID 已复制", "success");
    } catch (e) {
      showToast("复制失败，请手动复制", "error");
    }
    document.body.removeChild(textarea);
  }
};

// 精简时间格式 (07-30 14:31)
const formatShortDateTime = (timestamp) => {
  if (!timestamp) return "";
  // 年月日时分 年不显示20
  const date = new Date(timestamp);
  const year = date.getFullYear().toString().slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
};

const getLocalDateString = (isoString) => {
  if (!isoString) return "";
  const dateObj = new Date(isoString);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const matchesDateFilter = (createdAt) => {
  if (!selectedDate.value) return true;
  return getLocalDateString(createdAt) === selectedDate.value;
};

// Statistics
const stats = computed(() => {
  const pendingCount = records.value.filter(
    (r) =>
      (r.status === "pending" || r.status === "review") &&
      matchesDateFilter(r.created_at),
  ).length;
  const successCount = records.value.filter(
    (r) => r.status === "success" && matchesDateFilter(r.created_at),
  ).length;
  const failedCount = records.value.filter(
    (r) => r.status === "failed" && matchesDateFilter(r.created_at),
  ).length;
  return { pendingCount, successCount, failedCount };
});

// Filtered records
const filteredRecords = computed(() => {
  let list = [];
  if (activeTab.value === "pending") {
    list = records.value.filter(
      (r) => r.status === "pending" || r.status === "review",
    );
  } else if (activeTab.value === "success") {
    list = records.value.filter((r) => r.status === "success");
  } else if (activeTab.value === "failed") {
    list = records.value.filter((r) => r.status === "failed");
  }

  list = list.filter((r) => matchesDateFilter(r.created_at));

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (r) =>
        r.account_id.toLowerCase().includes(q) ||
        (platforms[r.platform]?.name || "").toLowerCase().includes(q),
    );
  }

  return list;
});

let timeInterval = null;
onMounted(() => {
  fetchRecords();
  timeInterval = setInterval(() => {
    records.value = [...records.value];
  }, 60000);
});

onUnmounted(() => {
  if (timeInterval) clearInterval(timeInterval);
});
</script>

<template>
  <div
    class="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans select-none antialiased max-w-md mx-auto relative shadow-2xl border-x border-slate-200/80 pb-10">
    <!-- Toast Component -->
    <div v-if="toast.show"
      class="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-sm rounded-2xl p-4 shadow-xl border backdrop-blur-md transition-all duration-300 transform scale-100 flex items-center gap-3"
      :class="{
        'bg-emerald-50 text-emerald-800 border-emerald-200/80': toast.type === 'success',
        'bg-rose-50 text-rose-800 border-rose-200/80': toast.type === 'error',
        'bg-slate-50 text-slate-800 border-slate-200/80': toast.type === 'info',
      }">
      <span class="text-xl">
        <template v-if="toast.type === 'success'">✨</template>
        <template v-else-if="toast.type === 'error'">🚨</template>
        <template v-else>💡</template>
      </span>
      <p class="text-sm font-semibold leading-tight">{{ toast.message }}</p>
    </div>

    <!-- Header Section -->
    <header
      class="sticky top-0 bg-white/90 backdrop-blur-md z-30 border-b border-slate-200/60 px-5 py-4 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div
          class="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-indigo-600 flex items-center justify-center shadow-md shadow-rose-500/10">
          <span class="text-base text-white">🤝</span>
        </div>
        <h1
          class="text-lg font-bold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
          自媒体互关助手
        </h1>
      </div>
      <button @click="fetchRecords" :disabled="isLoading"
        class="w-9 h-9 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-100 active:scale-95 transition-all text-slate-500 disabled:opacity-50 disabled:pointer-events-none"
        title="刷新列表">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform"
          :class="{ 'animate-spin text-rose-500': isLoading }" fill="none" viewBox="0 0 24 24" stroke="currentColor"
          stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
        </svg>
      </button>
    </header>

    <!-- Supabase Warning -->
    <div v-if="!isSupabaseConfigured"
      class="m-4 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex flex-col gap-3 shadow-sm">
      <div class="flex items-center gap-2 font-bold text-amber-700">
        <span>⚠️</span>
        <h3>Supabase 数据库未配置</h3>
      </div>
      <p class="text-xs leading-relaxed text-amber-800">
        请配置环境变量后再试。
      </p>
    </div>

    <!-- Top Input Form -->
    <section class="p-4 flex flex-col gap-3 border-b border-slate-200/60 bg-white/60">
      <div class="flex gap-2">
        <!-- Platform Selector -->
        <div class="relative w-1/3">
          <select v-model="inputPlatform"
            class="w-full h-11 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 outline-none appearance-none focus:border-rose-500/40 transition-all text-center cursor-pointer">
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
          <input ref="inputRef" v-model="inputAccountId" type="text" placeholder="输入账号 ID 或昵称"
            @keyup.enter="handleAddFollow"
            class="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-rose-500/40 focus:ring-1 focus:ring-rose-500/10 transition-all" />
          <button v-if="inputAccountId" @click="inputAccountId = ''"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
            ✕
          </button>
        </div>
      </div>

      <!-- Add Button -->
      <button @click="handleAddFollow" :disabled="isSubmitting || !inputAccountId.trim()"
        class="w-full h-11 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-105 active:scale-[0.99] transition-all shadow-md shadow-rose-500/10 disabled:opacity-50 disabled:pointer-events-none">
        <span v-if="isSubmitting"
          class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
        <span v-else>➕</span>
        添加关注
      </button>
    </section>

    <!-- Search & Filter Bar -->
    <div class="px-4 pt-3.5 pb-2 flex gap-2" v-if="records.length > 0">
      <div class="flex-1 relative">
        <input v-model="searchQuery" type="text" placeholder="搜索账号 ID..."
          class="w-full h-9 pl-9 pr-8 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-slate-300 transition-all" />
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
        <button v-if="searchQuery" @click="searchQuery = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
          ✕
        </button>
      </div>

      <div class="flex items-center gap-1 shrink-0">
        <div class="relative shrink-0 flex items-center">
          <input ref="dateInputRef" v-model="selectedDate" type="date" @click="showDatePicker"
            class="h-9 px-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-slate-300 transition-all cursor-pointer w-28 text-center" />
          <div v-if="!selectedDate"
            class="absolute inset-0 flex items-center justify-center pointer-events-none text-xs font-semibold text-slate-400 bg-white rounded-xl border border-slate-200">
            📅 日期
          </div>
        </div>
        <button v-if="selectedDate" @click="selectedDate = ''"
          class="w-7 h-9 rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center text-xs active:bg-slate-50 transition-all"
          title="清除日期筛选">
          ✕
        </button>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <nav class="px-4 py-2">
      <div class="w-full bg-slate-200/60 p-1 rounded-xl flex gap-1 border border-slate-200/40">
        <button @click="activeTab = 'pending'"
          :class="activeTab === 'pending' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all">
          待处理 <span class="ml-0.5 text-[11px] opacity-70">({{ stats.pendingCount }})</span>
        </button>
        <button @click="activeTab = 'success'"
          :class="activeTab === 'success' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all">
          已互关 <span class="ml-0.5 text-[11px] opacity-70">({{ stats.successCount }})</span>
        </button>
        <button @click="activeTab = 'failed'"
          :class="activeTab === 'failed' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'"
          class="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all">
          未互关 <span class="ml-0.5 text-[11px] opacity-70">({{ stats.failedCount }})</span>
        </button>
      </div>
    </nav>

    <!-- Records List Area (重新设计的精简高密度卡片/列表) -->
    <main class="flex-1 px-4 pt-1 overflow-y-auto">
      <!-- Empty State -->
      <div v-if="filteredRecords.length === 0"
        class="py-16 flex flex-col items-center justify-center text-center gap-3 animate-fade-in">
        <span class="text-4xl filter drop-shadow">📭</span>
        <h3 class="text-sm font-semibold text-slate-400">暂无相关记录</h3>
      </div>

      <!-- Records Container -->
      <div v-else
        class="bg-white rounded-xl border border-slate-200/80 shadow-sm divide-y divide-slate-100 overflow-hidden">
        <TransitionGroup name="list">
          <div v-for="record in filteredRecords" :key="record.id"
            class="flex items-center justify-between px-3 py-2.5 hover:bg-slate-50/80 transition-colors gap-2">
            <!-- 1. 平台颜色点 + 账号 ID (点击 ID 复制) -->
            <div class="flex items-center gap-2 min-w-0 flex-1 cursor-pointer select-none"
              @click="handleCopyId(record.id, record.account_id)" title="点击复制 ID">
              <!-- 平台颜色指示点（红色/黑色/粉蓝色） -->
              <span class="w-2 h-2 rounded-full shrink-0"
                :class="platforms[record.platform]?.dotClass || 'bg-rose-500'"></span>

              <!-- ID 文本 -->
              <span class="text-xs font-mono font-medium text-slate-700 truncate hover:text-rose-500 transition-colors">
                {{ record.account_id }}
              </span>
            </div>

            <!-- 2. 精简时间 (只显示月-日 时:分) -->
            <span class="text-[12px] font-mono text-slate-400 shrink-0">
              {{ formatShortDateTime(record.created_at) }}
            </span>

            <!-- 3. 伪装成精致标签的下拉框 -->
            <div class="relative shrink-0">
              <select v-model="record.status" @change="handleUpdateStatus(record.id, record.status)"
                class="appearance-none text-[11px] font-medium py-1 pl-2 pr-5 rounded-lg border focus:outline-none transition-all cursor-pointer"
                :class="{
                  'bg-amber-50 text-amber-600 border-amber-200': record.status === 'pending' || record.status === 'review',
                  'bg-emerald-50 text-emerald-600 border-emerald-200': record.status === 'success',
                  'bg-rose-50 text-rose-500 border-rose-200': record.status === 'failed'
                }">
                <option value="pending">⌛ 待处理</option>
                <option value="success">✓ 已互关</option>
                <option value="failed">✕ 未互关</option>
              </select>
              <!-- 自定义下拉箭角 -->
              <div class="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-slate-400">
                <svg class="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <!-- 4. 优化后的优雅删除按钮 -->
            <button @click.stop="handleDeleteRecord(record.id)"
              class="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors shrink-0" title="删除记录">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clip-rule="evenodd" />
              </svg>
            </button>
          </div>
        </TransitionGroup>
      </div>
    </main>

    <!-- Footer decoration -->
    <footer class="mt-6 text-center text-[10px] text-slate-400">
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