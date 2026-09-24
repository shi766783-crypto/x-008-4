<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>排行榜</h2>
        <p class="page-sub">和家庭一起进步，看得见的坚持</p>
      </div>
    </div>

    <div class="rank-grid">
      <div class="card rank-col">
        <h3 class="rank-title">🔥 记账坚持榜</h3>
        <p class="rank-sub">按每位成员当前连续记账天数排序</p>
        <div class="rank-list">
          <div v-for="(r, i) in streakList" :key="r.id" class="rank-item">
            <span class="rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
            <span class="rank-name">{{ r.name }}</span>
            <div class="rank-bar-track">
              <div class="rank-bar" :style="{ width: r.pct + '%' }"></div>
            </div>
            <span class="rank-val">{{ r.value }} 天</span>
          </div>
        </div>
        <div class="rank-empty" v-if="streakList.length === 0">暂无启用成员</div>
      </div>

      <div class="card rank-col">
        <h3 class="rank-title">🐢 节约达人榜</h3>
        <p class="rank-sub">按本月个人储蓄率（(收入-支出)/收入）排序</p>
        <div class="rank-list">
          <div v-for="(r, i) in savingList" :key="r.id" class="rank-item">
            <span class="rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
            <span class="rank-name">{{ r.name }}</span>
            <div class="rank-bar-track">
              <div class="rank-bar saving" :style="{ width: r.pct + '%' }"></div>
            </div>
            <span class="rank-val">{{ r.value }}%</span>
          </div>
        </div>
        <div class="rank-empty" v-if="savingList.length === 0">暂无数据</div>
        <p class="rank-note" v-if="savingList.length">仅统计本月收入 / 支出账单；停用成员不参与排名，其历史账单仍保留。</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '../data/store.js'
import { todayStr } from '../core/utils.js'
import { TRANSACTION_TYPES } from '../core/constants.js'

const store = useStore()

const activeMembers = computed(() => store.members.filter((m) => m.active))
const currentMonth = todayStr().slice(0, 7)

// 某位成员当前连续记账天数（转账也算一次记账）
function memberStreak(memberId) {
  const days = new Set(store.transactions.filter((t) => t.memberId === memberId).map((t) => t.date))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    if (days.has(todayStr(-i))) streak++
    else break
  }
  return streak
}

// 某位成员本月收入 / 支出（不含转账）
function memberMonthFlow(memberId) {
  let income = 0
  let expense = 0
  for (const t of store.transactions) {
    if (t.memberId !== memberId || !t.date.startsWith(currentMonth)) continue
    if (t.type === TRANSACTION_TYPES.INCOME) income += t.amount
    else if (t.type === TRANSACTION_TYPES.EXPENSE) expense += t.amount
  }
  return { income, expense }
}

function withPct(rows) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
  return rows
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN'))
    .map((r) => ({ ...r, pct: max > 0 ? Math.min(100, Math.round((r.value / max) * 100)) : 0 }))
}

const streakList = computed(() =>
  withPct(activeMembers.value.map((m) => ({ id: m.id, name: m.name, value: memberStreak(m.id) })))
)

const savingList = computed(() =>
  withPct(
    activeMembers.value
      .map((m) => {
        const { income, expense } = memberMonthFlow(m.id)
        const rate = income > 0 ? Math.round(((income - expense) / income) * 100) : 0
        return { id: m.id, name: m.name, value: Math.max(0, rate), income, expense }
      })
      // 本月完全没有收支的成员不参与储蓄率排名
      .filter((r) => r.income > 0 || r.expense > 0)
  )
)
</script>

<style scoped>
.rank-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 14px;
}
.rank-title {
  margin: 0 0 2px;
  font-size: 16px;
}
.rank-sub {
  margin: 0 0 14px;
  font-size: 12px;
  color: var(--text-secondary);
}
.rank-note {
  margin: 12px 0 0;
  font-size: 11px;
  color: var(--text-secondary);
}
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.rank-no {
  width: 22px;
  height: 22px;
  border-radius: 8px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.rank-no.top {
  background: var(--accent);
  color: #fff;
}
.rank-name {
  min-width: 52px;
  max-width: 96px;
  flex-shrink: 0;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-bar-track {
  flex: 1;
  height: 10px;
  background: var(--bg-elevated);
  border-radius: 999px;
  overflow: hidden;
}
.rank-bar {
  height: 100%;
  background: linear-gradient(90deg, #f07d4f, #f9a54f);
  border-radius: 999px;
}
.rank-bar.saving {
  background: linear-gradient(90deg, #3aa66f, #57c785);
}
.rank-val {
  width: 52px;
  text-align: right;
  font-weight: 700;
  flex-shrink: 0;
}
.rank-empty {
  text-align: center;
  color: var(--text-secondary);
  padding: 20px;
  font-size: 13px;
}
</style>
