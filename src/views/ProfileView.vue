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
        <div class="profile-sub">成员：{{ activeCount }} 人{{ inactiveCount ? `（另有 ${inactiveCount} 人已停用）` : '' }} · 加入于 {{ joinDate }}</div>
      </div>
      <div class="profile-stat">
        <span>累计积分</span>
        <b>{{ store.points }}</b>
      </div>
    </div>

    <section>
      <div class="block-head">
        <h3 class="block-title">家庭成员（{{ store.members.length }} 人）</h3>
        <button class="btn btn-primary btn-sm" @click="openCreate">＋ 添加成员</button>
      </div>
      <div class="member-grid">
        <div v-for="m in memberRows" :key="m.id" class="card member-card" :class="{ off: !m.active }">
          <div class="member-top">
            <div class="member-avatar">{{ m.name.slice(0, 1) }}</div>
            <div class="member-info">
              <div class="member-name">
                {{ m.name }}
                <span v-if="!m.active" class="badge member-off-tag">已停用</span>
              </div>
              <div class="member-role">{{ m.role || '未设置角色' }}</div>
            </div>
          </div>
          <div class="member-stats">
            <span>账单 {{ m.count }} 笔</span>
            <span>本月支出 ¥{{ money(m.monthExpense) }}</span>
          </div>
          <div class="member-actions">
            <button class="link-btn" @click="openEdit(m)">编辑</button>
            <button class="link-btn" @click="toggleActive(m)">{{ m.active ? '停用' : '启用' }}</button>
            <button class="link-btn danger" @click="openDelete(m)">删除</button>
          </div>
        </div>
      </div>
      <div class="card empty" v-if="store.members.length === 0">
        <p>还没有家庭成员，点击「添加成员」开始管理吧。</p>
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
            <em>{{ t.date }} · {{ accountName(t.accountId || t.fromAccountId) }} · {{ memberLabel(t).name }}</em>
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

    <Modal :title="editingMember ? '编辑成员' : '添加成员'" @close="memberModalOpen = false" v-if="memberModalOpen">
      <form id="member-form" @submit.prevent="submitMember" class="form">
        <label class="field">
          <span>姓名 / 称呼</span>
          <input v-model="memberForm.name" required maxlength="12" placeholder="如：张先生" />
        </label>
        <label class="field">
          <span>角色（选填）</span>
          <input v-model="memberForm.role" maxlength="10" placeholder="如：户主、配偶、孩子" />
        </label>
        <p class="form-tip" v-if="formError" style="color: var(--expense)">{{ formError }}</p>
      </form>
      <template #footer>
        <button type="button" class="btn" @click="memberModalOpen = false">取消</button>
        <button type="submit" class="btn btn-primary" form="member-form">保存</button>
      </template>
    </Modal>

    <Modal title="删除成员" @close="deleteModalOpen = false" v-if="deleteModalOpen && deletingMember">
      <p class="del-intro">
        成员「<b>{{ deletingMember.name }}</b>」名下共有 <b>{{ deleteCount }}</b> 笔历史账单。删除成员不可恢复，请选择这些账单的处理方式：
      </p>
      <label class="del-option" v-if="deleteCount > 0">
        <input type="radio" v-model="deleteMode" value="keep" />
        <span>
          <b>保留账单，留在该成员名下</b>
          <em>账单不会丢失，成员姓名会随账单保存，列表中显示为「{{ deletingMember.name }}（已删除）」。</em>
        </span>
      </label>
      <label class="del-option" v-if="deleteCount > 0">
        <input type="radio" v-model="deleteMode" value="unassign" />
        <span>
          <b>保留账单，改为「未归属」</b>
          <em>账单仍然保留并计入家庭统计，但不再归属任何成员。</em>
        </span>
      </label>
      <label class="del-option danger-opt">
        <input type="radio" v-model="deleteMode" value="delete" />
        <span>
          <b>{{ deleteCount > 0 ? `同时删除这 ${deleteCount} 笔账单` : '直接删除该成员' }}</b>
          <em v-if="deleteCount > 0">账单将被永久删除，相关账户余额会自动回滚，此操作不可撤销。</em>
          <em v-else>该成员名下没有账单，可直接删除。</em>
        </span>
      </label>
      <template #footer>
        <button type="button" class="btn" @click="deleteModalOpen = false">取消</button>
        <button type="button" class="btn btn-danger" @click="confirmDelete">确认删除</button>
      </template>
    </Modal>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { useStore, refreshKeys, controllersApi } from '../data/store.js'
import { money } from '../core/utils.js'
import { BUDGET_WARN_RATIO, TRANSACTION_TYPES } from '../core/constants.js'
import Modal from '../components/Modal.vue'

const store = useStore()
const { achievement, member: memberApi } = controllersApi

const allBadges = computed(() => achievement.ACHIEVEMENTS)
const totalBadges = computed(() => allBadges.value.length)
const owned = (id) => store.achievements.some((a) => a.id === id)

const activeCount = computed(() => store.members.filter((m) => m.active).length)
const inactiveCount = computed(() => store.members.length - activeCount.value)
const joinDate = store.user.createdAt ? new Date(store.user.createdAt).toLocaleDateString('zh-CN') : '—'
const currentMonth = new Date().toISOString().slice(0, 7)

const memberRows = computed(() =>
  [...store.members]
    .sort((a, b) => Number(!a.active) - Number(!b.active) || a.createdAt - b.createdAt)
    .map((m) => {
      const txs = store.transactions.filter((t) => t.memberId === m.id)
      const monthExpense = txs
        .filter((t) => t.type === TRANSACTION_TYPES.EXPENSE && t.date.startsWith(currentMonth))
        .reduce((s, t) => s + t.amount, 0)
      return { ...m, count: txs.length, monthExpense }
    })
)

// ---- 添加 / 编辑成员 ----
const memberModalOpen = ref(false)
const editingMember = ref(null)
const memberForm = reactive(memberApi.emptyMemberForm())
const formError = ref('')

const openCreate = () => {
  editingMember.value = null
  Object.assign(memberForm, memberApi.emptyMemberForm())
  formError.value = ''
  memberModalOpen.value = true
}

const openEdit = (m) => {
  editingMember.value = m
  Object.assign(memberForm, { name: m.name, role: m.role || '' })
  formError.value = ''
  memberModalOpen.value = true
}

const submitMember = () => {
  if (!memberForm.name.trim()) {
    formError.value = '请填写成员姓名'
    return
  }
  let ok
  if (editingMember.value) ok = memberApi.updateMember(editingMember.value.id, memberForm)
  else ok = memberApi.addMember(memberForm)
  if (!ok) {
    formError.value = '已存在同名成员，请换一个称呼'
    return
  }
  refreshKeys('members')
  memberModalOpen.value = false
}

// ---- 停用 / 启用 ----
const toggleActive = (m) => {
  if (m.active) {
    if (!memberApi.setMemberActive(m.id, false)) {
      alert('至少需要保留一位启用成员，停用前请先添加或启用其他成员。')
      return
    }
  } else {
    memberApi.setMemberActive(m.id, true)
  }
  refreshKeys('members')
}

// ---- 删除成员 ----
const deleteModalOpen = ref(false)
const deletingMember = ref(null)
const deleteCount = ref(0)
const deleteMode = ref('keep')

const openDelete = (m) => {
  deletingMember.value = m
  deleteCount.value = memberApi.countMemberTransactions(m.id)
  // 没有账单时默认直接删除；有账单时默认保留
  deleteMode.value = deleteCount.value > 0 ? 'keep' : 'delete'
  deleteModalOpen.value = true
}

const confirmDelete = () => {
  memberApi.removeMember(deletingMember.value.id, deleteMode.value)
  deleteModalOpen.value = false
  controllersApi.achievement.updateAchievements()
  refreshKeys('members', 'transactions', 'accounts', 'achievements', 'points')
}

const recentList = computed(() =>
  [...store.transactions].sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1)).slice(0, 8)
)
const accountName = (id) => store.accounts.find((a) => a.id === id)?.name || '未知账户'
const memberLabel = (t) => memberApi.memberNameOf(store.members, t)
const rowTitle = (t) => (t.type === 'transfer' ? `转账 ${accountName(t.toAccountId)}` : t.category)
const amtText = (t) =>
  t.type === TRANSACTION_TYPES.INCOME ? `+¥${money(t.amount)}` : t.type === TRANSACTION_TYPES.EXPENSE ? `-¥${money(t.amount)}` : `¥${money(t.amount)}`

const budgetRows = computed(() => {
  const month = currentMonth
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
  gap: 12px;
}
.block-head .block-title { margin: 22px 0 10px; }
.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}
.btn-danger {
  background: var(--expense);
  border-color: transparent;
  color: #fff;
}
.btn-danger:hover { filter: brightness(0.95); }
.member-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 12px;
}
.member-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.member-card.off { opacity: 0.72; }
.member-top {
  display: flex;
  align-items: center;
  gap: 10px;
}
.member-avatar {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f8df9, #936df0);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 800;
  flex-shrink: 0;
}
.member-card.off .member-avatar {
  background: var(--text-secondary);
}
.member-info { min-width: 0; }
.member-name {
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}
.member-off-tag { font-size: 10px; }
.member-role {
  font-size: 12px;
  color: var(--text-secondary);
}
.member-stats {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-elevated);
  border-radius: 10px;
  padding: 6px 10px;
}
.member-actions {
  display: flex;
  gap: 12px;
}
.del-intro {
  margin: 0 0 14px;
  font-size: 13px;
}
.del-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 10px 12px;
  margin-bottom: 10px;
  cursor: pointer;
  font-size: 13px;
}
.del-option:has(input:checked) {
  border-color: var(--accent);
  background: rgba(79, 141, 249, 0.06);
}
.del-option.danger-opt:has(input:checked) {
  border-color: var(--expense);
  background: rgba(224, 82, 96, 0.06);
}
.del-option b { display: block; }
.del-option em {
  font-style: normal;
  font-size: 12px;
  color: var(--text-secondary);
  display: block;
  margin-top: 2px;
}
.form-tip {
  margin: 0;
  font-size: 12px;
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
