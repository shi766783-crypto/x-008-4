<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>个人中心</h2>
        <p class="page-sub">{{ store.user.name || '我的家庭' }} 的财务总览</p>
      </div>
    </div>

    <div class="profile-top card">
      <div class="avatar">{{ (store.user.name || '家').slice(0, 1) }}</div>
      <div class="profile-meta">
        <div class="profile-name">{{ store.user.name || '我的家庭' }}</div>
        <div class="profile-sub">{{ memberSummary }} · 加入于 {{ joinDate }}</div>
      </div>
      <div class="profile-stat">
        <span>累计积分</span>
        <b>{{ store.points }}</b>
      </div>
    </div>

    <section>
      <div class="block-head">
        <h3 class="block-title">家庭成员</h3>
        <button class="btn btn-sm" @click="goMembers">管理成员</button>
      </div>
      <div class="section-grid">
        <div v-for="m in memberRows" :key="m.id" class="member-card card" :class="{ off: !m.active }">
          <div class="member-card-top">
            <span class="member-avatar" :style="{ background: m.color }">{{ m.name.slice(0, 1) }}</span>
            <div class="member-card-meta">
              <b>{{ m.name }}</b>
              <em>{{ m.role }}{{ !m.active ? ' · 已停用' : '' }}</em>
            </div>
          </div>
          <div class="member-card-nums">
            <span>账单 {{ m.txCount }} 笔</span>
            <span class="neg">本月支出 ¥{{ money(m.monthExpense) }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="store.accounts.length">
      <h3 class="block-title">我的账户</h3>
      <div class="section-grid">
        <div v-for="a in store.accounts" :key="a.id" class="mini-card card">
          <span>{{ a.name }}</span>
          <b>¥{{ money(a.balance) }}</b>
        </div>
      </div>
    </section>

    <section v-if="recentList.length">
      <h3 class="block-title">最近记账</h3>
      <div class="card list">
        <div v-for="t in recentList" :key="t.id" class="list-row">
          <span class="row-type" :class="t.type">{{ t.type === 'income' ? '收' : t.type === 'expense' ? '支' : '转' }}</span>
          <span class="row-main">
            <b>{{ rowTitle(t) }}</b>
            <em>{{ memberNameOf(t.memberId) }} · {{ t.date }} · {{ accountName(t.accountId || t.fromAccountId) }}</em>
          </span>
          <span class="row-amount" :class="t.type">{{ amtText(t) }}</span>
        </div>
      </div>
    </section>

    <section v-if="budgetRows.length">
      <h3 class="block-title">预算执行情况（本月）</h3>
      <div class="card list">
        <div v-for="b in budgetRows" :key="b.id" class="list-row">
          <span class="row-main">
            <b>{{ b.category }}</b>
            <em>已用 ¥{{ money(b.used) }} / ¥{{ money(b.limit) }}</em>
          </span>
          <span class="badge" :class="b.status">{{ b.status === 'danger' ? '超支' : b.status === 'warn' ? '预警' : '正常' }}</span>
        </div>
      </div>
    </section>

    <section v-if="goalRows.length">
      <h3 class="block-title">储蓄目标进度</h3>
      <div class="section-grid">
        <div v-for="g in goalRows" :key="g.id" class="mini-card card goal-mini">
          <span>{{ g.name }}</span>
          <b>{{ g.percent }}%</b>
          <em>¥{{ money(g.savedAmount) }} / ¥{{ money(g.targetAmount) }}</em>
        </div>
      </div>
    </section>

    <section>
      <h3 class="block-title">成就徽章（{{ store.achievements.length }}/{{ totalBadges }}）</h3>
      <div class="badges-row">
        <div v-for="a in allBadges" :key="a.id" class="mini-badge" :class="{ locked: !owned(a.id) }" :title="a.desc">
          <span class="mini-badge-icon">{{ a.icon }}</span>
          <span>{{ a.name }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useStore, controllersApi } from '../data/store.js'
import { money } from '../core/utils.js'
import { BUDGET_WARN_RATIO, TRANSACTION_TYPES } from '../core/constants.js'
import { navigate } from '../core/appNav.js'

const store = useStore()
const { achievement } = controllersApi

const allBadges = computed(() => achievement.ACHIEVEMENTS)
const totalBadges = computed(() => allBadges.value.length)
const owned = (id) => store.achievements.some((a) => a.id === id)

const memberNameOf = (id) => store.members.find((m) => m.id === id)?.name || '未分配'
const goMembers = () => navigate('members')

const currentMonth = computed(() => new Date().toISOString().slice(0, 7))

const memberRows = computed(() =>
  [...store.members]
    .sort((a, b) => Number(b.active !== false) - Number(a.active !== false))
    .map((m) => {
      const txs = store.transactions.filter((t) => t.memberId === m.id)
      return {
        ...m,
        txCount: txs.length,
        monthExpense: txs.filter((t) => t.type === 'expense' && t.date.startsWith(currentMonth.value)).reduce((s, t) => s + t.amount, 0)
      }
    })
)

const memberSummary = computed(() => {
  const total = store.members.length
  const active = store.members.filter((m) => m.active !== false).length
  const inactive = total - active
  return `成员：${active} 人${inactive ? `（另有 ${inactive} 人已停用）` : ''}`
})

const joinDate = store.user.createdAt ? new Date(store.user.createdAt).toLocaleDateString('zh-CN') : '—'
const recentList = computed(() =>
  [...store.transactions].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 8)
)
const accountName = (id) => store.accounts.find((a) => a.id === id)?.name || '未知账户'
const rowTitle = (t) => (t.type === 'transfer' ? `转账 ${accountName(t.toAccountId)}` : t.category)
const amtText = (t) =>
  t.type === TRANSACTION_TYPES.INCOME ? `+¥${money(t.amount)}` : t.type === TRANSACTION_TYPES.EXPENSE ? `-¥${money(t.amount)}` : `¥${money(t.amount)}`

const budgetRows = computed(() => {
  const month = currentMonth.value
  return store.budgets
    .filter((b) => b.month === month)
    .map((b) => {
      const used = store.transactions
        .filter((t) => t.type === 'expense' && t.category === b.category && t.date.startsWith(month))
        .reduce((s, t) => s + t.amount, 0)
      const percent = b.limit > 0 ? used / b.limit : 0
      return { ...b, used, status: percent > 1 ? 'danger' : percent >= BUDGET_WARN_RATIO ? 'warn' : 'ok' }
    })
})

const goalRows = computed(() =>
  store.goals.map((g) => ({
    ...g,
    percent: g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0
  }))
)
</script>

<style scoped>
.profile-top {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
.avatar {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: linear-gradient(135deg, #4f8df9, #936df0);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 800;
}
.profile-meta {
  flex: 1;
}
.profile-name {
  font-size: 18px;
  font-weight: 800;
}
.profile-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}
.profile-stat {
  text-align: right;
  display: flex;
  flex-direction: column;
}
.profile-stat span {
  font-size: 12px;
  color: var(--text-secondary);
}
.profile-stat b {
  font-size: 24px;
  color: var(--accent);
}
.block-title {
  font-size: 15px;
  margin: 22px 0 10px;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.block-head .block-title {
  margin-bottom: 10px;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 8px;
}
.member-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
}
.member-card.off {
  opacity: 0.65;
}
.member-card-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.member-avatar {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  flex-shrink: 0;
}
.member-card.off .member-avatar {
  filter: grayscale(0.7);
}
.member-card-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.member-card-meta b {
  font-size: 14px;
}
.member-card-meta em {
  font-style: normal;
  font-size: 12px;
  color: var(--text-secondary);
}
.member-card-nums {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}
.section-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 10px;
}
.mini-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  font-size: 13px;
  color: var(--text-secondary);
}
.mini-card b {
  color: var(--text-primary);
  font-size: 17px;
}
.card.list {
  display: flex;
  flex-direction: column;
  padding: 6px 16px;
}
.list-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}
.list-row:last-child { border-bottom: none; }
.row-type {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.row-type.income { background: var(--income); }
.row-type.expense { background: var(--expense); }
.row-type.transfer { background: var(--accent); }
.row-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.row-main b { font-size: 14px; }
.row-main em {
  font-style: normal;
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-amount { font-weight: 800; }
.row-amount.income { color: var(--income); }
.row-amount.expense { color: var(--expense); }
.row-amount.transfer { color: var(--accent); }
.badge { font-size: 12px; }
.goal-mini em {
  font-style: normal;
  font-size: 12px;
}
.badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.mini-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
}
.mini-badge-icon { font-size: 16px; }
.mini-badge.locked {
  filter: grayscale(1);
  opacity: 0.5;
}
</style>
