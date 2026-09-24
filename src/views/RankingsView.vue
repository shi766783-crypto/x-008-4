<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>排行榜</h2>
        <p class="page-sub">按每位成员的真实记账数据统计，停用成员不计入排行</p>
      </div>
    </div>

    <div class="rank-grid">
      <div class="card rank-col">
        <h3 class="rank-title">🔥 记账坚持榜</h3>
        <p class="rank-sub">按当前连续记账天数排序</p>
        <div class="rank-list">
          <div v-for="(r, i) in streakList" :key="r.id" class="rank-item">
            <span class="rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
            <span class="rank-avatar" :style="{ background: r.color }">{{ r.name.slice(0, 1) }}</span>
            <span class="rank-name">{{ r.name }}</span>
            <div class="rank-bar-track">
              <div class="rank-bar" :style="{ width: r.pct + '%' }"></div>
            </div>
            <span class="rank-val">{{ r.value }} 天</span>
          </div>
        </div>
        <div class="rank-empty" v-if="streakList.length === 0">暂无启用中的成员</div>
      </div>

      <div class="card rank-col">
        <h3 class="rank-title">🐢 节约达人榜</h3>
        <p class="rank-sub">按本月储蓄率（（收入-支出）/收入）排序</p>
        <div class="rank-list">
          <div v-for="(r, i) in savingList" :key="r.id" class="rank-item">
            <span class="rank-no" :class="{ top: i < 3 }">{{ i + 1 }}</span>
            <span class="rank-avatar" :style="{ background: r.color }">{{ r.name.slice(0, 1) }}</span>
            <span class="rank-name">{{ r.name }}</span>
            <div class="rank-bar-track">
              <div class="rank-bar saving" :style="{ width: r.pct + '%' }"></div>
            </div>
            <span class="rank-val">{{ r.value }}%</span>
          </div>
        </div>
        <div class="rank-empty" v-if="savingList.length === 0">暂无数据</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore } from '../data/store.js'
import { todayStr } from '../core/utils.js'

const store = useStore()

const activeMembers = computed(() => store.members.filter((m) => m.active !== false))

// 每位成员名下的非转账账单（转账是家庭内部资金流动，不计入个人收支）
const memberTxs = (memberId) => store.transactions.filter((t) => t.memberId === memberId && t.type !== 'transfer')

function currentStreakOf(memberId) {
  const days = new Set(memberTxs(memberId).map((t) => t.date))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    if (days.has(todayStr(-i))) streak++
    else break
  }
  return streak
}

function monthlySavingRateOf(memberId, month) {
  let income = 0
  let expense = 0
  for (const t of memberTxs(memberId)) {
    if (!t.date.startsWith(month)) continue
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  if (income <= 0) return 0
  return Math.max(0, Math.round(((income - expense) / income) * 100))
}

function withPct(rows) {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
  return rows.map((r) => ({ ...r, pct: max > 0 ? Math.min(100, Math.round((r.value / max) * 100)) : 0 }))
}

const streakList = computed(() =>
  withPct(
    activeMembers.value
      .map((m) => ({ id: m.id, name: m.name, color: m.color, value: currentStreakOf(m.id) }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh'))
  )
)

const savingList = computed(() => {
  const month = new Date().toISOString().slice(0, 7)
  return withPct(
    activeMembers.value
      .map((m) => ({ id: m.id, name: m.name, color: m.color, value: monthlySavingRateOf(m.id, month) }))
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh'))
  )
})
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
.rank-avatar {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}
.rank-name {
  width: 60px;
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
